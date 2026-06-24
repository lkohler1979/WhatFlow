-- ============================================================
-- WhatFlow — Supabase RLS Policies + Helper Functions
-- Execute após rodar: npx prisma migrate deploy
-- ============================================================

-- ============================================================
-- HELPER FUNCTION: retorna o tenant_id do usuário logado
-- Lê do JWT claim customizado inserido no Supabase Auth
-- ============================================================

CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid,
    NULL
  );
$$;

CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    'VIEWER'
  );
$$;

-- ============================================================
-- HABILITAR RLS EM TODAS AS TABELAS
-- ============================================================

ALTER TABLE tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys             ENABLE ROW LEVEL SECURITY;
ALTER TABLE instances            ENABLE ROW LEVEL SECURITY;
ALTER TABLE flows                ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_tags    ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_notes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_contacts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_configs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs           ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES: tenants
-- ============================================================
CREATE POLICY "tenant_select_own" ON tenants
  FOR SELECT USING (id = get_current_tenant_id());

CREATE POLICY "tenant_update_owner" ON tenants
  FOR UPDATE USING (
    id = get_current_tenant_id()
    AND get_current_user_role() IN ('OWNER', 'ADMIN')
  );

-- ============================================================
-- POLICIES: users
-- ============================================================
CREATE POLICY "users_select_same_tenant" ON users
  FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY "users_insert_owner_admin" ON users
  FOR INSERT WITH CHECK (
    tenant_id = get_current_tenant_id()
    AND get_current_user_role() IN ('OWNER', 'ADMIN')
  );

CREATE POLICY "users_update_owner_admin" ON users
  FOR UPDATE USING (
    tenant_id = get_current_tenant_id()
    AND get_current_user_role() IN ('OWNER', 'ADMIN')
  );

CREATE POLICY "users_delete_owner" ON users
  FOR DELETE USING (
    tenant_id = get_current_tenant_id()
    AND get_current_user_role() = 'OWNER'
  );

-- ============================================================
-- POLICIES: instances
-- ============================================================
CREATE POLICY "instances_select" ON instances
  FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY "instances_insert" ON instances
  FOR INSERT WITH CHECK (
    tenant_id = get_current_tenant_id()
    AND get_current_user_role() IN ('OWNER', 'ADMIN')
  );

CREATE POLICY "instances_update" ON instances
  FOR UPDATE USING (
    tenant_id = get_current_tenant_id()
    AND get_current_user_role() IN ('OWNER', 'ADMIN')
  );

CREATE POLICY "instances_delete" ON instances
  FOR DELETE USING (
    tenant_id = get_current_tenant_id()
    AND get_current_user_role() IN ('OWNER', 'ADMIN')
  );

-- ============================================================
-- POLICIES: flows
-- ============================================================
CREATE POLICY "flows_select" ON flows
  FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY "flows_insert" ON flows
  FOR INSERT WITH CHECK (
    tenant_id = get_current_tenant_id()
    AND get_current_user_role() IN ('OWNER', 'ADMIN', 'AGENT')
  );

CREATE POLICY "flows_update" ON flows
  FOR UPDATE USING (
    tenant_id = get_current_tenant_id()
    AND get_current_user_role() IN ('OWNER', 'ADMIN', 'AGENT')
  );

CREATE POLICY "flows_delete" ON flows
  FOR DELETE USING (
    tenant_id = get_current_tenant_id()
    AND get_current_user_role() IN ('OWNER', 'ADMIN')
  );

-- ============================================================
-- POLICIES: contacts
-- ============================================================
CREATE POLICY "contacts_select" ON contacts
  FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY "contacts_insert" ON contacts
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "contacts_update" ON contacts
  FOR UPDATE USING (tenant_id = get_current_tenant_id());

CREATE POLICY "contacts_delete" ON contacts
  FOR DELETE USING (
    tenant_id = get_current_tenant_id()
    AND get_current_user_role() IN ('OWNER', 'ADMIN')
  );

-- ============================================================
-- POLICIES: conversations
-- ============================================================
CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY "conversations_insert" ON conversations
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "conversations_update" ON conversations
  FOR UPDATE USING (tenant_id = get_current_tenant_id());

-- ============================================================
-- POLICIES: messages
-- ============================================================
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE tenant_id = get_current_tenant_id()
    )
  );

CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE tenant_id = get_current_tenant_id()
    )
  );

-- ============================================================
-- POLICIES: campaigns
-- ============================================================
CREATE POLICY "campaigns_select" ON campaigns
  FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY "campaigns_insert" ON campaigns
  FOR INSERT WITH CHECK (
    tenant_id = get_current_tenant_id()
    AND get_current_user_role() IN ('OWNER', 'ADMIN', 'AGENT')
  );

CREATE POLICY "campaigns_update" ON campaigns
  FOR UPDATE USING (
    tenant_id = get_current_tenant_id()
    AND get_current_user_role() IN ('OWNER', 'ADMIN', 'AGENT')
  );

CREATE POLICY "campaigns_delete" ON campaigns
  FOR DELETE USING (
    tenant_id = get_current_tenant_id()
    AND get_current_user_role() IN ('OWNER', 'ADMIN')
  );

-- ============================================================
-- POLICIES: ai_configs (apenas OWNER/ADMIN veem chaves de IA)
-- ============================================================
CREATE POLICY "ai_configs_select" ON ai_configs
  FOR SELECT USING (
    tenant_id = get_current_tenant_id()
    AND get_current_user_role() IN ('OWNER', 'ADMIN')
  );

CREATE POLICY "ai_configs_insert" ON ai_configs
  FOR INSERT WITH CHECK (
    tenant_id = get_current_tenant_id()
    AND get_current_user_role() IN ('OWNER', 'ADMIN')
  );

CREATE POLICY "ai_configs_update" ON ai_configs
  FOR UPDATE USING (
    tenant_id = get_current_tenant_id()
    AND get_current_user_role() IN ('OWNER', 'ADMIN')
  );

-- ============================================================
-- POLICIES: webhooks
-- ============================================================
CREATE POLICY "webhooks_all" ON webhooks
  FOR ALL USING (
    tenant_id = get_current_tenant_id()
    AND get_current_user_role() IN ('OWNER', 'ADMIN')
  );

-- ============================================================
-- POLICIES: audit_logs (somente leitura para OWNER/ADMIN)
-- ============================================================
CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT USING (
    tenant_id = get_current_tenant_id()
    AND get_current_user_role() IN ('OWNER', 'ADMIN')
  );

CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

-- ============================================================
-- ÍNDICES EXTRAS PARA PERFORMANCE
-- ============================================================

-- Full-text search em contatos
CREATE INDEX IF NOT EXISTS contacts_name_trgm ON contacts
  USING gin(name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS contacts_phone_trgm ON contacts
  USING gin(phone gin_trgm_ops);

-- Full-text search em mensagens
CREATE INDEX IF NOT EXISTS messages_content_trgm ON messages
  USING gin(content gin_trgm_ops)
  WHERE content IS NOT NULL;

-- Índice para busca de conversas por tenant + status + data
CREATE INDEX IF NOT EXISTS conversations_tenant_status_date ON conversations
  (tenant_id, status, last_message_at DESC);

-- Índice para campanhas agendadas (job scheduler consulta isto)
CREATE INDEX IF NOT EXISTS campaigns_scheduled ON campaigns
  (scheduled_at, status)
  WHERE status = 'SCHEDULED' AND scheduled_at IS NOT NULL;

-- Índice para webhook deliveries com retry pendente
CREATE INDEX IF NOT EXISTS webhook_deliveries_retry ON webhook_deliveries
  (next_retry_at, status)
  WHERE status IN ('PENDING', 'RETRYING') AND next_retry_at IS NOT NULL;

-- ============================================================
-- VIEWS PARA ANALYTICS (usadas pelos endpoints /analytics/*)
-- ============================================================

CREATE OR REPLACE VIEW v_message_stats AS
SELECT
  c.tenant_id,
  c.instance_id,
  date_trunc('hour', m.timestamp) AS hour_bucket,
  COUNT(*) FILTER (WHERE m.direction = 'INBOUND')  AS inbound_count,
  COUNT(*) FILTER (WHERE m.direction = 'OUTBOUND') AS outbound_count,
  COUNT(*) FILTER (WHERE m.status = 'FAILED')      AS failed_count
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
GROUP BY c.tenant_id, c.instance_id, hour_bucket;

CREATE OR REPLACE VIEW v_conversation_stats AS
SELECT
  tenant_id,
  instance_id,
  status,
  COUNT(*) AS total,
  AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60)
    FILTER (WHERE resolved_at IS NOT NULL) AS avg_resolution_minutes
FROM conversations
GROUP BY tenant_id, instance_id, status;

CREATE OR REPLACE VIEW v_campaign_stats AS
SELECT
  c.tenant_id,
  c.id              AS campaign_id,
  c.name,
  c.status,
  c.total_contacts,
  c.sent_count,
  c.delivered_count,
  c.read_count,
  c.failed_count,
  CASE WHEN c.sent_count > 0
    THEN ROUND((c.delivered_count::numeric / c.sent_count) * 100, 2)
    ELSE 0
  END AS delivery_rate,
  CASE WHEN c.sent_count > 0
    THEN ROUND((c.read_count::numeric / c.sent_count) * 100, 2)
    ELSE 0
  END AS read_rate
FROM campaigns c;

-- ============================================================
-- FUNCTION: auto-incrementar contadores de campanha via trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_campaign_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    IF NEW.status = 'SENT' THEN
      UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = NEW.campaign_id;
    ELSIF NEW.status = 'DELIVERED' THEN
      UPDATE campaigns SET delivered_count = delivered_count + 1 WHERE id = NEW.campaign_id;
    ELSIF NEW.status = 'READ' THEN
      UPDATE campaigns SET read_count = read_count + 1 WHERE id = NEW.campaign_id;
    ELSIF NEW.status = 'FAILED' THEN
      UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = NEW.campaign_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER campaign_contact_status_change
  AFTER UPDATE OF status ON campaign_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_counters();

-- ============================================================
-- SEED: dados iniciais (rodar apenas em desenvolvimento)
-- ============================================================

-- Descomente para usar em dev:
/*
INSERT INTO tenants (id, name, slug, plan) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Empresa Demo', 'demo', 'PRO');

INSERT INTO tags (tenant_id, name, color) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Lead Quente', '#E74C3C'),
  ('00000000-0000-0000-0000-000000000001', 'Cliente', '#27AE60'),
  ('00000000-0000-0000-0000-000000000001', 'Suporte', '#3498DB'),
  ('00000000-0000-0000-0000-000000000001', 'VIP', '#F39C12');
*/
