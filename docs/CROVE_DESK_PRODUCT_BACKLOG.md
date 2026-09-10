# Crove Desk Product Backlog & Feature Roadmap

This document defines the complete product backlog and feature roadmap for **Crove Desk** (`desk.crove.com`), structured for publication to **Frill Feedback** ([https://feedback.crove.com/b/n0e9nkvg/feature-ideas](https://feedback.crove.com/b/n0e9nkvg/feature-ideas)).

---

## 1. Omnichannel Customer Support Channels

### [Shipped] Telegram Bot Channel Integration
- **Status**: `Shipped`
- **Topics**: `Integrations 🔗`
- **Description**: Native bidirectional integration with Telegram Bot API. Supports automated zero-config webhook binding, customer conversation routing, AI Agent auto-reply, and human agent outbox delivery.
- **Key Capabilities**:
  - Auto-binding Telegram Webhook via Telegram Bot token without requiring manual URL setup.
  - Inbound updates ingest into `desk.t_message` and link to customer identity (`external_source: telegram`).
  - Asynchronous outbox worker delivers agent and AI replies back to Telegram Chat.

### [Planned] Zalo Official Account (OA) Channel Gateway
- **Status**: `Planned`
- **Topics**: `Integrations 🔗`
- **Description**: Native channel adapter for Zalo Official Account (OA). Enables Vietnamese businesses to receive customer support inquiries and dispatch AI/agent replies via Zalo CS messaging API.
- **Key Capabilities**:
  - Inbound webhook handler at `/api/third/zalo/webhook/:channel_id`.
  - External user identity resolution (`external_source: zalo_oa`).
  - Outbound queue dispatcher for Zalo CS `/v3.0/oa/message/cs` endpoint.

### [Planned] Inbound Email-to-Ticket & SMTP/IMAP Gateway
- **Status**: `Planned`
- **Topics**: `Integrations 🔗`, `Improvement 👍`
- **Description**: Convert inbound customer support emails into threaded conversation tickets automatically. Allows agents and AI to reply directly via email.
- **Key Capabilities**:
  - IMAP polling and webhook ingestion (via Brevo / SendGrid / Postmark).
  - Thread ID parsing (In-Reply-To / References header matching).
  - Outbound email dispatching with custom support address formatting.

### [Under Consideration] WhatsApp Business API & Cloud Gateway
- **Status**: `Under Consideration`
- **Topics**: `Integrations 🔗`
- **Description**: Connect WhatsApp Business Cloud API to Crove Desk. Support template messages, interactive buttons, and real-time chat sync for international customer support.
- **Key Capabilities**:
  - Meta Graph API webhook ingestion for incoming WhatsApp chats.
  - Message status delivery receipts (sent, delivered, read).
  - Pre-approved HSM template message triggers for re-engagement.

### [Shipped] Live Chat Web Widget SDK with Custom Theming & JWT Verification
- **Status**: `Shipped`
- **Topics**: `Improvement 👍`
- **Description**: Embeddable lightweight web chat widget with customizable theme colors, position, and secure customer JWT token verification.
- **Key Capabilities**:
  - Statically bundleable `@/public/sdk/agent-desk-sdk.min.js`.
  - Dual-mode identity (anonymous visitor or authenticated customer token).
  - Real-time WebSocket event bridge for typing indicators and instant messaging.

---

## 2. AI Agent Runtime & Automation

### [Shipped] OpenAI-Compatible AI Engine & Auto-Bootstrap
- **Status**: `Shipped`
- **Topics**: `Improvement 👍`
- **Description**: Zero-config LLM and vector embedding integration supporting OpenAI, DOS.AI, DeepSeek, and OpenAI-compatible gateways via environment variables.
- **Key Capabilities**:
  - Auto-bootstraps default LLM and embedding configurations on startup from `OPENAI_API_KEY` / `OPENAI_BASE_URL`.
  - Configurable model parameters, dimensions, retry counts, and execution timeouts.

### [Shipped] Smart Answerability Gate & Confidence Scoring for RAG
- **Status**: `Shipped`
- **Topics**: `Improvement 👍`
- **Description**: Evaluates retrieval confidence and document relevancy before AI generates a response, preventing hallucinations on unsupported customer questions.
- **Key Capabilities**:
  - Strict semantic relevance checking against indexed knowledge base vectors.
  - Auto-fallback to polite service notices when customer inquiry is out of scope.

### [Planned] Automated Human Handoff on Low AI Confidence
- **Status**: `Planned`
- **Topics**: `Improvement 👍`
- **Description**: Seamlessly escalates customer conversations to online human support agents with full conversation context transfer when the AI Answerability Gate confidence falls below threshold.
- **Key Capabilities**:
  - Automated status transition from `ai_serving` to `pending` queue.
  - Agent routing based on skills, availability, and round-robin dispatch.
  - Notification triggers across WeCom, Telegram, and dashboard alerts.

### [Under Consideration] Visual AI Workflow Canvas & Node-based Orchestration
- **Status**: `Under Consideration`
- **Topics**: `Improvement 👍`
- **Description**: Legacy node-based drag-and-drop workflow designer (Flowgram) for deterministic multi-step support flows. (Kept under consideration in favor of dynamic AI-native agentic loops).
- **Key Capabilities**:
  - Embedded Flowgram canvas integrated with Next.js App Router.
  - Conditional branch nodes, LLM prompt nodes, MCP tool nodes, and HTTP request nodes.

### [Under Consideration] Automated Conversation Summarization & Sentiment Analysis
- **Status**: `Under Consideration`
- **Topics**: `Improvement 👍`
- **Description**: AI automatically generates resolution summaries and tags customer sentiment (Positive, Neutral, Frustrated) upon ticket closure.
- **Key Capabilities**:
  - Auto-generates concise 2-sentence wrap-up notes for internal records.
  - Sentiment classification over the conversation arc for customer health scoring.

---

## 3. 2-Tier CRM & Ecosystem Integration

### [Shipped] 2-Tier Hybrid Sync: Relational Mirror with Twenty CRM & DOS.Me
- **Status**: `Shipped`
- **Topics**: `Integrations 🔗`, `CRM`
- **Description**: Real-time bidirectional synchronization of Company and Customer profiles between Twenty CRM, DOS.Me, and Crove Desk via webhook events.
- **Key Capabilities**:
  - Inbound webhook handler at `/api/webhooks/ecosystem` and `/api/webhooks/org-sync`.
  - Idempotent upsert of `t_company` and `t_customer` with external ID mapping.
  - HMAC-SHA256 timestamp signature verification with replay protection.
  - Outbound dispatch of `company.created` and `customer.created` events.

### [Planned] MCP Tool Calling: Live Deal & Subscription Status Lookup from CRM
- **Status**: `Planned`
- **Topics**: `Integrations 🔗`, `CRM`
- **Description**: Equips Crove Desk AI Agents with Model Context Protocol (MCP) tools to query live CRM deals, subscription tiers, and customer records on demand.
- **Key Capabilities**:
  - Seamless MCP client connecting to `https://crm.crove.com/api/mcp`.
  - Tools: `crove_crm.get_subscription_status`, `crove_crm.search_help_center`.

### [Under Consideration] Auto-Create CRM Deals & Follow-up Tasks from Support Inquiries
- **Status**: `Under Consideration`
- **Topics**: `Integrations 🔗`, `CRM`
- **Description**: AI Agent identifies sales opportunities during customer support conversations and automatically creates Deals and follow-up Tasks in Twenty CRM.
- **Key Capabilities**:
  - Intent detection for upgrade requests, new license inquiries, or expansion signals.
  - Automatic invocation of `crove_crm.create_opportunity` and `crove_crm.create_task`.

---

## 4. Multi-tenancy, Workspaces & Security

### [Shipped] Multi-Tenant Workspace Management with Just-In-Time SSO
- **Status**: `Shipped`
- **Topics**: `Improvement 👍`
- **Description**: Isolated multi-organization workspace switching, member role management, and JIT user provisioning via DOS.Me OIDC single sign-on.
- **Key Capabilities**:
  - Database schema models: `t_organization`, `t_organization_member`.
  - Just-in-Time (JIT) provisioning from OIDC claims during login.
  - Self-service organization create, update, member invite, and role assignment dialogs.

### [Planned] Granular Role-Based Access Control (RBAC) for Support Agents
- **Status**: `Planned`
- **Topics**: `Improvement 👍`
- **Description**: Customizable permission matrices for Tier 1 agents, senior support specialists, and support administrators across channels and knowledge bases.
- **Key Capabilities**:
  - Fine-grained permission codes for viewing private customer notes, reassigning tickets, and managing knowledge bases.
  - Team-based assignment queues.

### [Under Consideration] Configurable SLA Policies & Priority Escalation Rules
- **Status**: `Under Consideration`
- **Topics**: `Improvement 👍`
- **Description**: Define First Response Time and Resolution Time SLA targets based on customer tier, ticket priority, and business hours with automated alerts.
- **Key Capabilities**:
  - SLA timer indicators in conversation feed.
  - Auto-escalation notifications to managers when SLA breach is imminent.

---

## 5. Knowledge Base, Help Center & Community

### [Shipped] Multi-language Knowledge Base & Vector FAQ Indexing
- **Status**: `Shipped`
- **Topics**: `Improvement 👍`
- **Description**: Publish help documentation and categorized FAQs with multilingual support (EN, VI, ZH) and automatic Qdrant vector embedding indexing.
- **Key Capabilities**:
  - Full WYSIWYG editor and Markdown article support.
  - Automatic vector chunking and indexing into Qdrant vector database.
  - Dynamic multilingual reader interface with instant search.

### [Under Consideration] Public Customer Community Forum & Peer Discussion Board
- **Status**: `Under Consideration`
- **Topics**: `Improvement 👍`
- **Description**: Community discussion space allowing customers to post questions, share tips, vote on best answers, with agent moderation.
- **Key Capabilities**:
  - User post submissions, threaded comments, and upvoting.
  - Moderator controls (approve, lock, convert post to support ticket).

### [Under Consideration] Custom Domain & White-Label Support Portal
- **Status**: `Under Consideration`
- **Topics**: `Improvement 👍`
- **Description**: CNAME custom domain mapping and custom branding (colors, logos, favicons) for customer-facing Help Centers.
- **Key Capabilities**:
  - SSL certificate provisioning for custom domains (e.g., `help.yourdomain.com`).
  - Dynamic brand theming configured per organization workspace.

---

## 6. Analytics & Quality Assurance

### [Under Consideration] Omnichannel CSAT & Customer Satisfaction Surveys
- **Status**: `Under Consideration`
- **Topics**: `Improvement 👍`
- **Description**: Trigger automated CSAT star ratings and feedback prompts across Web Widget, Telegram, and Zalo OA when tickets are resolved.
- **Key Capabilities**:
  - 1-to-5 star rating prompt sent on ticket closure.
  - Aggregated agent CSAT scorecards and customer satisfaction trends.
