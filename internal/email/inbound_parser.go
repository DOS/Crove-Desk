package email

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
)

// ParseInboundWebhook parses raw webhook payload from various email providers into a slice of normalized InboundEmailPayloads.
func ParseInboundWebhook(contentType string, rawBody []byte, form url.Values) ([]InboundEmailPayload, error) {
	contentType = strings.ToLower(contentType)

	// 1. If form data provided (e.g. SendGrid Inbound Parse or Mailgun webhook)
	if len(form) > 0 {
		// Mailgun format check
		if form.Get("sender") != "" || form.Get("recipient") != "" {
			fromEmail, fromName := ParseAddress(form.Get("from"))
			if fromEmail == "" {
				fromEmail, fromName = ParseAddress(form.Get("sender"))
			}
			toEmail, toName := ParseAddress(form.Get("recipient"))
			if toEmail == "" {
				toEmail, toName = ParseAddress(form.Get("To"))
			}
			bodyText := form.Get("body-plain")
			if bodyText == "" {
				bodyText = form.Get("stripped-text")
			}
			bodyHTML := form.Get("body-html")
			if bodyHTML == "" {
				bodyHTML = form.Get("stripped-html")
			}

			return []InboundEmailPayload{
				{
					FromEmail:  fromEmail,
					FromName:   fromName,
					ToEmail:    toEmail,
					ToName:     toName,
					Subject:    strings.TrimSpace(form.Get("subject")),
					BodyText:   strings.TrimSpace(bodyText),
					BodyHTML:   strings.TrimSpace(bodyHTML),
					MessageID:  strings.TrimSpace(form.Get("Message-Id")),
					InReplyTo:  strings.TrimSpace(form.Get("In-Reply-To")),
					References: strings.TrimSpace(form.Get("References")),
				},
			}, nil
		}

		// SendGrid format check
		if form.Get("from") != "" || form.Get("to") != "" {
			fromEmail, fromName := ParseAddress(form.Get("from"))
			toEmail, toName := ParseAddress(form.Get("to"))
			return []InboundEmailPayload{
				{
					FromEmail: fromEmail,
					FromName:  fromName,
					ToEmail:   toEmail,
					ToName:    toName,
					Subject:   strings.TrimSpace(form.Get("subject")),
					BodyText:  strings.TrimSpace(form.Get("text")),
					BodyHTML:  strings.TrimSpace(form.Get("html")),
				},
			}, nil
		}
	}

	rawStr := strings.TrimSpace(string(rawBody))
	if rawStr == "" {
		return nil, nil
	}

	// 2. Try Brevo webhook format
	var brevoWebhook BrevoInboundWebhook
	if err := json.Unmarshal(rawBody, &brevoWebhook); err == nil && len(brevoWebhook.Items) > 0 {
		var results []InboundEmailPayload
		for _, item := range brevoWebhook.Items {
			fromEmail, fromName := ParseAddress(item.Sender)
			toEmail, toName := ParseAddress(item.Recipient)
			msgID := ""
			if len(item.UUID) > 0 {
				msgID = item.UUID[0]
			}
			results = append(results, InboundEmailPayload{
				FromEmail: fromEmail,
				FromName:  fromName,
				ToEmail:   toEmail,
				ToName:    toName,
				Subject:   strings.TrimSpace(item.Subject),
				BodyText:  strings.TrimSpace(item.RawTextBody),
				BodyHTML:  strings.TrimSpace(item.RawHTMLBody),
				MessageID: msgID,
				Headers:   item.Headers,
			})
		}
		return results, nil
	}

	// 3. Try Postmark Inbound Webhook format
	var postmarkWebhook PostmarkInboundWebhook
	if err := json.Unmarshal(rawBody, &postmarkWebhook); err == nil && (postmarkWebhook.From != "" || postmarkWebhook.Subject != "") {
		fromEmail, fromName := ParseAddress(postmarkWebhook.From)
		if postmarkWebhook.FromName != "" {
			fromName = postmarkWebhook.FromName
		}
		toEmail, toName := ParseAddress(postmarkWebhook.To)
		headersMap := make(map[string]string)
		inReplyTo := ""
		references := ""
		for _, h := range postmarkWebhook.Headers {
			headersMap[h.Name] = h.Value
			if strings.EqualFold(h.Name, "In-Reply-To") {
				inReplyTo = h.Value
			}
			if strings.EqualFold(h.Name, "References") {
				references = h.Value
			}
		}

		return []InboundEmailPayload{
			{
				FromEmail:  fromEmail,
				FromName:   fromName,
				ToEmail:    toEmail,
				ToName:     toName,
				Subject:    strings.TrimSpace(postmarkWebhook.Subject),
				BodyText:   strings.TrimSpace(postmarkWebhook.TextBody),
				BodyHTML:   strings.TrimSpace(postmarkWebhook.HtmlBody),
				MessageID:  strings.TrimSpace(postmarkWebhook.MessageID),
				InReplyTo:  inReplyTo,
				References: references,
				Headers:    headersMap,
			},
		}, nil
	}

	// 4. Try Standard Generic / Cloudflare Email Routing format
	var generic GenericInboundWebhook
	if err := json.Unmarshal(rawBody, &generic); err == nil && generic.From != "" {
		fromEmail, fromName := ParseAddress(generic.From)
		if generic.FromName != "" {
			fromName = generic.FromName
		}
		toEmail, toName := ParseAddress(generic.To)
		if generic.ToName != "" {
			toName = generic.ToName
		}
		body := generic.Text
		if body == "" {
			body = generic.Body
		}

		return []InboundEmailPayload{
			{
				FromEmail:  fromEmail,
				FromName:   fromName,
				ToEmail:    toEmail,
				ToName:     toName,
				Subject:    strings.TrimSpace(generic.Subject),
				BodyText:   strings.TrimSpace(body),
				BodyHTML:   strings.TrimSpace(generic.HTML),
				MessageID:  strings.TrimSpace(generic.MessageID),
				InReplyTo:  strings.TrimSpace(generic.InReplyTo),
				References: strings.TrimSpace(generic.References),
				Headers:    generic.Headers,
			},
		}, nil
	}

	return nil, fmt.Errorf("unrecognized email webhook format")
}
