package services

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"
	"unicode"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/config"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/pkg/openidentity"
	"agent-desk/internal/whatsapp"
)

var WhatsAppInboundService = newWhatsAppInboundService()

func newWhatsAppInboundService() *whatsappInboundService {
	return &whatsappInboundService{}
}

type whatsappInboundService struct{}

// newWhatsAppClient builds the Graph API client used to fetch inbound media. It
// is a variable so tests can point it at a local stub instead of Meta.
var newWhatsAppClient = func(accessToken string) *whatsapp.Client {
	return whatsapp.NewClient(accessToken)
}

// whatsappMediaTimeout bounds resolving and fetching one inbound media object.
// Meta expires a media URL a few minutes after issuing it, so the download has
// to happen inline with webhook processing instead of being deferred to a job.
const whatsappMediaTimeout = 30 * time.Second

// whatsappCaptionFilenameLimit keeps a caption-derived file name short enough to
// read as a label in the workbench while leaving room for the extension.
const whatsappCaptionFilenameLimit = 80

// whatsappInboundRef is the resolved context shared by every message in one
// webhook change.
type whatsappInboundRef struct {
	channel       *models.Channel
	cfg           *dto.WhatsAppChannelConfig
	phoneNumberID string
}

// whatsappInboundContent is what one webhook message becomes on our side.
type whatsappInboundContent struct {
	messageType enums.IMMessageType
	content     string
	// payload is stored verbatim when set. Image and attachment messages must
	// carry the canonical asset payload, which leaves no room for webhook
	// metadata, so those set this instead of extra.
	payload string
	// extra is folded into the webhook metadata payload for text messages.
	extra map[string]any
}

// HandleWebhook processes an incoming Webhook event from WhatsApp Cloud API (Meta Graph Platform).
func (s *whatsappInboundService) HandleWebhook(ctx context.Context, channelID string, signatureHeader string, rawPayload []byte) error {
	var event whatsapp.WebhookEvent
	if err := json.Unmarshal(rawPayload, &event); err != nil {
		return fmt.Errorf("unmarshal whatsapp webhook failed: %w", err)
	}

	if event.Object != "whatsapp_business_account" && event.Object != "whatsapp" {
		return nil // Ignore non-whatsapp events
	}

	for _, entry := range event.Entry {
		for _, change := range entry.Changes {
			if change.Field != "messages" {
				continue
			}

			value := change.Value
			phoneNumberID := strings.TrimSpace(value.Metadata.PhoneNumberID)

			channel := s.resolveChannel(channelID, phoneNumberID)
			if channel == nil {
				slog.Warn("whatsapp webhook dropped, no matching channel",
					"channel_id", strings.TrimSpace(channelID),
					"phone_number_id", phoneNumberID,
					"waba_id", strings.TrimSpace(entry.ID),
				)
				continue
			}

			cfg, err := ChannelService.ParseWhatsAppChannelConfig(channel.ConfigJSON)
			if err != nil || cfg == nil {
				slog.Warn("whatsapp webhook dropped, unreadable channel config",
					"channel", channel.ID,
					"error", err,
				)
				continue
			}

			if err := verifyWhatsAppWebhook(cfg, signatureHeader, rawPayload); err != nil {
				return err
			}

			contactNames := make(map[string]string, len(value.Contacts))
			for _, contact := range value.Contacts {
				contactNames[strings.TrimSpace(contact.WaID)] = strings.TrimSpace(contact.Profile.Name)
			}

			ref := whatsappInboundRef{channel: channel, cfg: cfg, phoneNumberID: phoneNumberID}
			for i := range value.Messages {
				message := value.Messages[i]
				if err := s.handleMessage(ctx, ref, &message, contactNames); err != nil {
					// One undeliverable message must not drop the rest of the batch.
					slog.Error("process whatsapp inbound message failed",
						"channel", channel.ID,
						"whatsapp_message_id", strings.TrimSpace(message.ID),
						"type", strings.TrimSpace(message.Type),
						"error", err,
					)
				}
			}
		}
	}

	return nil
}

func (s *whatsappInboundService) resolveChannel(channelID string, phoneNumberID string) *models.Channel {
	if channelID = strings.TrimSpace(channelID); channelID != "" {
		if channel := ChannelService.Take("channel_id = ? AND channel_type = ? AND status = ?", channelID, enums.ChannelTypeWhatsApp, enums.StatusOk); channel != nil {
			return channel
		}
	}
	if phoneNumberID != "" {
		if channel := ChannelService.Take("channel_type = ? AND status = ? AND (channel_id = ? OR config_json LIKE ?)",
			enums.ChannelTypeWhatsApp, enums.StatusOk, phoneNumberID, "%"+phoneNumberID+"%"); channel != nil {
			return channel
		}
	}
	return ChannelService.Take("channel_type = ? AND status = ?", enums.ChannelTypeWhatsApp, enums.StatusOk)
}

func (s *whatsappInboundService) handleMessage(ctx context.Context, ref whatsappInboundRef, message *whatsapp.InboundMessage, contactNames map[string]string) error {
	senderPhone := strings.TrimSpace(message.From)
	if senderPhone == "" {
		return nil
	}
	if strings.TrimSpace(message.ID) == "" {
		return fmt.Errorf("whatsapp message is missing an id")
	}

	name := contactNames[senderPhone]
	if name == "" {
		name = fmt.Sprintf("WhatsApp User +%s", senderPhone)
	}
	externalUser := openidentity.ExternalUser{
		ExternalSource: enums.ExternalSourceWhatsApp,
		ExternalID:     senderPhone,
		ExternalName:   name,
	}

	conversation, err := ConversationService.Create(externalUser, ref.channel.ID, ref.channel.AIAgentID)
	if err != nil {
		return fmt.Errorf("create whatsapp conversation failed: %w", err)
	}

	content, err := s.buildContent(ctx, ref, message)
	if err != nil {
		return err
	}

	payload := content.payload
	if payload == "" {
		metadata := map[string]any{
			"whatsapp_message_id": strings.TrimSpace(message.ID),
			"whatsapp_from":       senderPhone,
			"whatsapp_phone_id":   ref.phoneNumberID,
			"whatsapp_type":       strings.TrimSpace(message.Type),
		}
		for key, value := range content.extra {
			metadata[key] = value
		}
		payloadBytes, err := json.Marshal(metadata)
		if err != nil {
			return fmt.Errorf("marshal whatsapp message payload failed: %w", err)
		}
		payload = string(payloadBytes)
	}

	_, err = MessageService.SendCustomerMessage(
		conversation.ID,
		fmt.Sprintf("wa_%s", strings.TrimSpace(message.ID)),
		content.messageType,
		content.content,
		payload,
		externalUser,
	)
	return err
}

// buildContent turns one webhook message into the message we store. Structured
// types that carry no prose still become a readable line, so a customer action
// never disappears from the conversation and the AI agent can see it happened.
func (s *whatsappInboundService) buildContent(ctx context.Context, ref whatsappInboundRef, message *whatsapp.InboundMessage) (*whatsappInboundContent, error) {
	switch strings.ToLower(strings.TrimSpace(message.Type)) {
	case whatsapp.MessageTypeText:
		if message.Text == nil {
			return nil, fmt.Errorf("whatsapp text message has no body")
		}
		return s.textContent(message.Text.Body)

	case whatsapp.MessageTypeImage:
		if message.Image == nil {
			return nil, fmt.Errorf("whatsapp image message has no image payload")
		}
		return s.mediaContent(ctx, ref, whatsappMediaRequest{
			mediaID:  message.Image.ID,
			mimeType: message.Image.MimeType,
			caption:  message.Image.Caption,
			label:    "Image",
			asImage:  true,
		})

	case whatsapp.MessageTypeDocument:
		if message.Document == nil {
			return nil, fmt.Errorf("whatsapp document message has no document payload")
		}
		return s.mediaContent(ctx, ref, whatsappMediaRequest{
			mediaID:  message.Document.ID,
			mimeType: message.Document.MimeType,
			caption:  message.Document.Caption,
			filename: message.Document.Filename,
			label:    "Document",
		})

	case whatsapp.MessageTypeVideo:
		if message.Video == nil {
			return nil, fmt.Errorf("whatsapp video message has no video payload")
		}
		return s.mediaContent(ctx, ref, whatsappMediaRequest{
			mediaID:  message.Video.ID,
			mimeType: message.Video.MimeType,
			caption:  message.Video.Caption,
			label:    "Video",
		})

	case whatsapp.MessageTypeAudio:
		if message.Audio == nil {
			return nil, fmt.Errorf("whatsapp audio message has no audio payload")
		}
		return s.mediaContent(ctx, ref, whatsappMediaRequest{
			mediaID:  message.Audio.ID,
			mimeType: message.Audio.MimeType,
			label:    "Audio",
		})

	case whatsapp.MessageTypeVoice:
		if message.Voice == nil {
			return nil, fmt.Errorf("whatsapp voice message has no voice payload")
		}
		return s.mediaContent(ctx, ref, whatsappMediaRequest{
			mediaID:  message.Voice.ID,
			mimeType: message.Voice.MimeType,
			label:    "Voice message",
		})

	case whatsapp.MessageTypeSticker:
		if message.Sticker == nil {
			return nil, fmt.Errorf("whatsapp sticker message has no sticker payload")
		}
		label := "Sticker"
		if message.Sticker.Animated {
			label = "Animated sticker"
		}
		return s.mediaContent(ctx, ref, whatsappMediaRequest{
			mediaID:  message.Sticker.ID,
			mimeType: message.Sticker.MimeType,
			label:    label,
			// An animated sticker is a WebP animation, which the workbench cannot
			// render as a still image, so it is filed as an attachment instead.
			asImage: !message.Sticker.Animated,
		})

	case whatsapp.MessageTypeLocation:
		if message.Location == nil {
			return nil, fmt.Errorf("whatsapp location message has no location payload")
		}
		return s.locationContent(message.Location), nil

	case whatsapp.MessageTypeContacts:
		return s.contactsContent(message.Contacts)

	case whatsapp.MessageTypeInteractive:
		return s.interactiveContent(message.Interactive)

	case whatsapp.MessageTypeButton:
		if message.Button == nil {
			return nil, fmt.Errorf("whatsapp button message has no button payload")
		}
		return s.textContent(whatsappFirstNonBlank(message.Button.Text, message.Button.Payload))

	case whatsapp.MessageTypeReaction:
		return s.reactionContent(message.Reaction), nil

	default:
		return s.unsupportedContent(message), nil
	}
}

func (s *whatsappInboundService) textContent(body string) (*whatsappInboundContent, error) {
	body = strings.TrimSpace(body)
	if body == "" {
		return nil, fmt.Errorf("whatsapp text message is empty")
	}
	return &whatsappInboundContent{messageType: enums.IMMessageTypeText, content: body}, nil
}

// whatsappMediaRequest describes one inbound media object to fetch and store.
type whatsappMediaRequest struct {
	mediaID  string
	mimeType string
	caption  string
	filename string
	label    string
	asImage  bool
}

func (s *whatsappInboundService) mediaContent(ctx context.Context, ref whatsappInboundRef, req whatsappMediaRequest) (*whatsappInboundContent, error) {
	if strings.TrimSpace(req.mediaID) == "" {
		return s.mediaFallback(req, fmt.Errorf("media id is empty"))
	}
	if strings.TrimSpace(ref.cfg.AccessToken) == "" {
		return s.mediaFallback(req, fmt.Errorf("channel has no access token"))
	}

	mediaCtx, cancel := context.WithTimeout(ctx, whatsappMediaTimeout)
	defer cancel()

	client := newWhatsAppClient(ref.cfg.AccessToken)
	meta, err := client.GetMediaMetadata(mediaCtx, req.mediaID)
	if err != nil {
		return s.mediaFallback(req, err)
	}

	var limit int64
	if cfg := config.GetCurrent(); cfg != nil {
		limit = cfg.Storage.MaxUploadSizeBytes()
	}
	data, contentType, err := client.DownloadMedia(mediaCtx, meta.URL, limit)
	if err != nil {
		return s.mediaFallback(req, err)
	}

	mimeType := whatsappFirstNonBlank(contentType, meta.MimeType, req.mimeType)
	filename := whatsappMediaFilename(req, mimeType)

	asset, err := AssetService.UploadBytes(data, whatsappAssetPrefix(req.asImage), filename, nil)
	if err != nil {
		// A blocked or oversized file is a policy decision, not a lost message:
		// the agent still has to see that the customer sent something.
		return s.mediaFallback(req, err)
	}

	assetPayload, err := buildIMMessageAssetPayload(asset)
	if err != nil {
		return s.mediaFallback(req, err)
	}

	messageType := enums.IMMessageTypeAttachment
	if req.asImage {
		messageType = enums.IMMessageTypeImage
	}
	return &whatsappInboundContent{
		messageType: messageType,
		// normalizeMessageContent replaces this with the stored file name, which
		// is why the caption is carried in the file name instead.
		content: whatsappFirstNonBlank(asset.Filename, "["+req.label+" Attachment]"),
		payload: assetPayload,
	}, nil
}

// mediaFallback records the message as text when the media itself could not be
// stored, so the customer's turn is never silently dropped from the conversation.
func (s *whatsappInboundService) mediaFallback(req whatsappMediaRequest, cause error) (*whatsappInboundContent, error) {
	slog.Warn("whatsapp inbound media not stored, falling back to text",
		"media_id", strings.TrimSpace(req.mediaID),
		"label", req.label,
		"error", cause,
	)
	label := "[" + req.label + " Attachment]"
	content := strings.TrimSpace(req.caption)
	if content == "" {
		content = label
	} else {
		content = content + " " + label
	}
	return &whatsappInboundContent{
		messageType: enums.IMMessageTypeText,
		content:     content,
		extra: map[string]any{
			"whatsapp_media_id":          strings.TrimSpace(req.mediaID),
			"whatsapp_media_unavailable": true,
		},
	}, nil
}

// whatsappMediaFilename picks the stored file name, which is also the label the
// workbench shows and the text the AI agent reads for this message.
//
// A sender-supplied document name always wins. Otherwise a caption becomes the
// name, because WhatsApp gives images, video, audio and stickers no filename and
// the caption is routinely the customer's actual question.
func whatsappMediaFilename(req whatsappMediaRequest, mimeType string) string {
	extension := whatsappExtensionForMimeType(mimeType)
	if filename := whatsappSlugFilename(req.filename); filename != "" {
		if whatsappExtensionFor(filename) == "" {
			return filename + extension
		}
		return filename
	}
	if caption := whatsappSlugFilename(strings.TrimSpace(req.caption)); caption != "" {
		return caption + extension
	}
	slug := strings.Map(func(r rune) rune {
		if r == ':' || r == '/' || r == '\\' || unicode.IsSpace(r) {
			return '_'
		}
		return r
	}, strings.TrimSpace(req.mediaID))
	if len(slug) > 48 {
		slug = slug[len(slug)-48:]
	}
	if slug == "" {
		slug = "media"
	}
	return "whatsapp_" + slug + extension
}

// whatsappSlugFilename reduces free-form WhatsApp text to a usable basename.
func whatsappSlugFilename(value string) string {
	value = strings.Map(func(r rune) rune {
		switch {
		case r == '\n' || r == '\r' || r == '\t':
			return ' '
		case strings.ContainsRune(`/\:*?"<>|`, r):
			return '-'
		case r < 0x20 || r == 0x7f:
			return -1
		default:
			return r
		}
	}, value)
	value = strings.TrimSpace(strings.Join(strings.Fields(value), " "))
	value = strings.Trim(value, ". ")
	if runes := []rune(value); len(runes) > whatsappCaptionFilenameLimit {
		value = strings.TrimSpace(string(runes[:whatsappCaptionFilenameLimit]))
	}
	return value
}

func whatsappExtensionFor(filename string) string {
	if index := strings.LastIndex(filename, "."); index > 0 && index < len(filename)-1 {
		return strings.ToLower(filename[index:])
	}
	return ""
}

func whatsappExtensionForMimeType(mimeType string) string {
	switch strings.ToLower(strings.TrimSpace(mimeType)) {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	case "image/heic":
		return ".heic"
	case "video/mp4":
		return ".mp4"
	case "video/3gpp":
		return ".3gp"
	case "audio/mpeg":
		return ".mp3"
	case "audio/mp4", "audio/x-m4a":
		return ".m4a"
	case "audio/aac":
		return ".aac"
	case "audio/ogg", "audio/opus":
		return ".ogg"
	case "audio/amr":
		return ".amr"
	case "audio/wav":
		return ".wav"
	case "application/pdf":
		return ".pdf"
	case "text/plain":
		return ".txt"
	default:
		return ".bin"
	}
}

func whatsappAssetPrefix(asImage bool) string {
	if asImage {
		return "images"
	}
	return "attachments"
}

func (s *whatsappInboundService) locationContent(location *whatsapp.LocationPayload) *whatsappInboundContent {
	parts := []string{fmt.Sprintf("%.6f,%.6f", location.Latitude, location.Longitude)}
	if name := strings.TrimSpace(location.Name); name != "" {
		parts = append(parts, name)
	}
	if address := strings.TrimSpace(location.Address); address != "" {
		parts = append(parts, address)
	}
	return &whatsappInboundContent{
		messageType: enums.IMMessageTypeText,
		content:     "[Location] " + strings.Join(parts, " · "),
		extra: map[string]any{
			"whatsapp_latitude":         location.Latitude,
			"whatsapp_longitude":        location.Longitude,
			"whatsapp_location_name":    strings.TrimSpace(location.Name),
			"whatsapp_location_address": strings.TrimSpace(location.Address),
		},
	}
}

func (s *whatsappInboundService) contactsContent(contacts []whatsapp.ContactRef) (*whatsappInboundContent, error) {
	if len(contacts) == 0 {
		return nil, fmt.Errorf("whatsapp contacts message has no contact card")
	}
	lines := make([]string, 0, len(contacts))
	for _, contact := range contacts {
		name := strings.TrimSpace(contact.Name.FormattedName)
		if name == "" {
			name = strings.TrimSpace(contact.Name.FirstName + " " + contact.Name.LastName)
		}
		fields := []string{"[Contact] " + name}
		for _, phone := range contact.Phones {
			if value := strings.TrimSpace(phone.Phone); value != "" {
				fields = append(fields, value)
			}
		}
		for _, email := range contact.Emails {
			if value := strings.TrimSpace(email.Email); value != "" {
				fields = append(fields, value)
			}
		}
		lines = append(lines, strings.Join(fields, " · "))
	}
	return &whatsappInboundContent{
		messageType: enums.IMMessageTypeText,
		content:     strings.Join(lines, "\n"),
		extra:       map[string]any{"whatsapp_contact_count": len(contacts)},
	}, nil
}

func (s *whatsappInboundService) interactiveContent(interactive *whatsapp.InteractivePayload) (*whatsappInboundContent, error) {
	if interactive == nil {
		return nil, fmt.Errorf("whatsapp interactive message has no payload")
	}
	var kind, title, value string
	switch interactive.Type {
	case "button_reply":
		kind = "button_reply"
		if interactive.ButtonReply != nil {
			title = interactive.ButtonReply.Title
			value = interactive.ButtonReply.ID
		}
	case "list_reply":
		kind = "list_reply"
		if interactive.ListReply != nil {
			title = interactive.ListReply.Title
			value = interactive.ListReply.ID
		}
	case "nfm_reply":
		kind = "nfm_reply"
		if interactive.NFMReply != nil {
			title = interactive.NFMReply.Body
			value = interactive.NFMReply.Name
		}
	default:
		kind = strings.TrimSpace(interactive.Type)
	}

	// The button label is what the customer actually chose and is the useful
	// signal for both the agent and the AI; the id is kept for correlation.
	content := strings.TrimSpace(whatsappFirstNonBlank(title, value))
	if content == "" {
		content = "[" + kind + "]"
	}
	return &whatsappInboundContent{
		messageType: enums.IMMessageTypeText,
		content:     content,
		extra: map[string]any{
			"whatsapp_interactive_type": kind,
			"whatsapp_interactive_id":   strings.TrimSpace(value),
		},
	}, nil
}

func (s *whatsappInboundService) reactionContent(reaction *whatsapp.ReactionPayload) *whatsappInboundContent {
	extra := map[string]any{"whatsapp_reaction": true}
	if reaction == nil {
		return &whatsappInboundContent{
			messageType: enums.IMMessageTypeText,
			content:     "[Reaction]",
			extra:       extra,
		}
	}
	extra["whatsapp_reaction_message_id"] = strings.TrimSpace(reaction.MessageID)
	extra["whatsapp_reaction_emoji"] = reaction.Emoji
	// An empty emoji is how WhatsApp reports a removed reaction.
	content := strings.TrimSpace(reaction.Emoji)
	if content == "" {
		content = "[Reaction removed]"
	}
	return &whatsappInboundContent{
		messageType: enums.IMMessageTypeText,
		content:     content,
		extra:       extra,
	}
}

func (s *whatsappInboundService) unsupportedContent(message *whatsapp.InboundMessage) *whatsappInboundContent {
	messageType := strings.TrimSpace(message.Type)
	if messageType == "" {
		messageType = "unknown"
	}
	content := "[" + messageType + "]"
	for _, webhookError := range message.Errors {
		if detail := strings.TrimSpace(webhookError.Message); detail != "" {
			content += " " + detail
		}
	}
	slog.Warn("whatsapp inbound message type is not supported",
		"type", messageType,
		"whatsapp_message_id", strings.TrimSpace(message.ID),
	)
	return &whatsappInboundContent{
		messageType: enums.IMMessageTypeText,
		content:     content,
		extra:       map[string]any{"whatsapp_unsupported": true},
	}
}

// verifyWhatsAppWebhook authenticates an inbound delivery. It fails closed: a
// payload is accepted only when its signature was verified against a configured
// Meta App Secret. Skipping the check when either side is missing would let
// anyone who learns a webhook URL write into a customer conversation, trigger AI
// replies and burn paid message quota.
func verifyWhatsAppWebhook(cfg *dto.WhatsAppChannelConfig, signatureHeader string, rawPayload []byte) error {
	appSecret := resolveMetaAppSecret(cfg.AppSecret)
	if appSecret == "" {
		slog.Error("whatsapp webhook rejected, no meta app secret configured",
			"hint", "set appSecret on the WhatsApp channel or META_APP_SECRET in the environment",
		)
		return errorsx.UnauthorizedI18n("error.e0349")
	}
	if strings.TrimSpace(signatureHeader) == "" {
		return errorsx.UnauthorizedI18n("error.e0350")
	}
	if !verifyWhatsAppSignature(appSecret, signatureHeader, rawPayload) {
		return errorsx.UnauthorizedI18n("error.auth.invalidSignature")
	}
	return nil
}

// resolveMetaAppSecret finds the Meta App Secret used to sign webhook payloads,
// preferring the channel's own credential over the deployment-wide one.
func resolveMetaAppSecret(channelAppSecret string) string {
	if secret := strings.TrimSpace(channelAppSecret); secret != "" {
		return secret
	}
	if serverCfg := config.GetCurrent(); serverCfg != nil {
		if secret := strings.TrimSpace(serverCfg.Messenger.AppSecret); secret != "" {
			return secret
		}
	}
	// config already binds META_APP_SECRET, but a deployment may export it after
	// configuration was loaded.
	return strings.TrimSpace(os.Getenv("META_APP_SECRET"))
}

func verifyWhatsAppSignature(appSecret string, signatureHeader string, payload []byte) bool {
	signature := strings.TrimSpace(signatureHeader)
	const prefix = "sha256="
	if !strings.HasPrefix(signature, prefix) {
		// A header we cannot interpret is not a header that proved anything.
		return false
	}
	expected := strings.TrimSpace(signature[len(prefix):])
	if expected == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(appSecret))
	mac.Write(payload)
	return hmac.Equal([]byte(hex.EncodeToString(mac.Sum(nil))), []byte(expected))
}

func whatsappFirstNonBlank(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}
