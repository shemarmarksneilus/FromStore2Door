CREATE EXTENSION IF NOT EXISTS citext;

-- =============== ENUM TYPES =================
CREATE TYPE account_role_enum           AS ENUM ('customer', 'driver', 'staff', 'admin');
CREATE TYPE package_status_enum         AS ENUM ('pre_alert', 'received', 'in_warehouse',
                                                 'cleared', 'out_for_delivery',
                                                 'delivered', 'returned');
CREATE TYPE manifest_status_enum        AS ENUM ('draft', 'in_transit', 'arrived',
                                                 'cleared', 'deconsolidated');
CREATE TYPE delivery_result_enum        AS ENUM ('delivered', 'failed', 'rescheduled');
CREATE TYPE notification_channel_enum   AS ENUM ('email', 'sms', 'push', 'in_app');
CREATE TYPE warehouse_type_enum         AS ENUM ('local', 'overseas');
CREATE TYPE api_provider_enum           AS ENUM ('extensiv', 'logiwa', 'camelot',
                                                 'softeon', 'magaya',
                                                 'generic_json', 'csv_ftp');
CREATE TYPE expense_category_enum       AS ENUM ('fuel', 'maintenance',
                                                 'salary', 'utilities', 'other');

-- =============== CORE IDENTITY =================
CREATE TABLE accounts (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email              citext UNIQUE NOT NULL,
    phone              text,
    full_name          text,
    role               account_role_enum NOT NULL,
    password_hash      text,             -- null if using external auth
    is_email_verified  boolean DEFAULT false,
    is_active          boolean DEFAULT true,
    last_login_at      timestamptz,
    created_at         timestamptz DEFAULT now(),
    updated_at         timestamptz DEFAULT now(),
    CONSTRAINT valid_phone CHECK (phone ~ '^\+?[1-9]\d{1,14}$'),
    CONSTRAINT valid_email CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);
CREATE INDEX idx_accounts_role ON accounts(role);

CREATE TABLE staff_roles (
    id          serial PRIMARY KEY,
    name        text UNIQUE NOT NULL,
    description text
);

CREATE TABLE staff_role_permissions (
    role_id     int REFERENCES staff_roles ON DELETE CASCADE,
    permission  text NOT NULL,
    PRIMARY KEY (role_id, permission)
);

CREATE TABLE account_staff_roles (
    account_id uuid REFERENCES accounts ON DELETE CASCADE,
    role_id    int REFERENCES staff_roles ON DELETE CASCADE,
    PRIMARY KEY (account_id, role_id)
);

CREATE TABLE account_groups (
    id          serial PRIMARY KEY,
    name        text UNIQUE NOT NULL,
    description text
);

CREATE TABLE account_group_members (
    account_id uuid REFERENCES accounts ON DELETE CASCADE,
    group_id   int REFERENCES account_groups ON DELETE CASCADE,
    PRIMARY KEY (account_id, group_id)
);

-- =============== BRANCHES =================
CREATE TABLE branches (
    id          serial PRIMARY KEY,
    name        text NOT NULL,
    address     jsonb,
    timezone    text NOT NULL,
    created_at  timestamptz DEFAULT now(),
    CONSTRAINT valid_timezone CHECK (timezone ~ '^[A-Za-z]+/[A-Za-z_]+$')
);
CREATE INDEX idx_branches_name ON branches(name);

-- =============== DEVICES =================
CREATE TABLE devices (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id     int REFERENCES branches ON DELETE SET NULL,
    account_id    uuid REFERENCES accounts ON DELETE SET NULL,
    name          text,
    os            text,
    app_version   text,
    push_token    text UNIQUE,
    registered_at timestamptz DEFAULT now(),
    last_seen_at  timestamptz,
    config        jsonb,
    CONSTRAINT valid_os CHECK (os IN ('iOS', 'Android', 'Windows', 'Linux', 'Other'))
);
CREATE INDEX idx_devices_account_id ON devices(account_id);
CREATE INDEX idx_devices_push_token ON devices(push_token);

-- =============== WAREHOUSE MASTER =================
CREATE TABLE warehouse_operators (
    id          serial PRIMARY KEY,
    name        text UNIQUE NOT NULL,
    website     text,
    api_docs    text
);

CREATE TABLE warehouses (
    id              serial PRIMARY KEY,
    operator_id     int REFERENCES warehouse_operators ON DELETE SET NULL,
    branch_id       int REFERENCES branches ON DELETE SET NULL,
    name            text NOT NULL,
    type            warehouse_type_enum NOT NULL,
    address         jsonb,
    timezone        text NOT NULL,
    api_config      jsonb,
    CONSTRAINT valid_timezone CHECK (timezone ~ '^[A-Za-z]+/[A-Za-z_]+$')
);
CREATE INDEX idx_warehouses_branch_id ON warehouses(branch_id);

CREATE TABLE warehouse_licenses (
    id                    serial PRIMARY KEY,
    warehouse_id          int REFERENCES warehouses ON DELETE CASCADE,
    license_type          text NOT NULL,
    license_no            text NOT NULL,
    issued_by             text,
    issue_date            date,
    expiry_date           date NOT NULL,
    document_url          text,
    last_notification_at  timestamptz,
    created_at            timestamptz DEFAULT now(),
    renewal_reminder_days int DEFAULT 30,
    CONSTRAINT valid_dates CHECK (issue_date <= expiry_date)
);
CREATE INDEX idx_warehouse_licenses_expiry_date ON warehouse_licenses(expiry_date);

-- =============== PARTNERSHIPS =================
CREATE TABLE partnerships (
    id                  serial PRIMARY KEY,
    operator_id         int REFERENCES warehouse_operators ON DELETE SET NULL,
    name                text NOT NULL,
    api_endpoint        text,
    default_credentials jsonb,
    is_active           boolean DEFAULT true,
    created_at          timestamptz DEFAULT now()
);
CREATE INDEX idx_partnerships_operator_id ON partnerships(operator_id);

-- =============== API CONNECTIONS =================
CREATE TABLE api_connections (
    id                  serial PRIMARY KEY,
    warehouse_id        int REFERENCES warehouses ON DELETE CASCADE,
    customer_id         uuid REFERENCES accounts ON DELETE SET NULL,
    provider            api_provider_enum NOT NULL,
    credentials         jsonb NOT NULL,
    partnership_type    text CHECK (partnership_type IN ('client_provided',
                                                         'pre_negotiated')),
    validation_status   text DEFAULT 'pending',
    last_validated_at   timestamptz,
    is_active           boolean DEFAULT true,
    created_at          timestamptz DEFAULT now()
);
CREATE INDEX idx_api_connections_warehouse_id ON api_connections(warehouse_id);
CREATE INDEX idx_api_connections_customer_id ON api_connections(customer_id);

CREATE TABLE event_stream (
    id                  bigserial PRIMARY KEY,
    api_connection_id   int REFERENCES api_connections ON DELETE CASCADE,
    entity_type         text NOT NULL,
    entity_id           text NOT NULL,
    action              text NOT NULL,
    payload             jsonb NOT NULL,
    processed           boolean DEFAULT false,
    created_at          timestamptz DEFAULT now()
);
CREATE INDEX idx_event_unprocessed ON event_stream (processed, created_at)
    WHERE processed = false;
CREATE INDEX idx_event_stream_entity ON event_stream(entity_type, entity_id);

-- =============== MANIFESTS =================
CREATE TABLE manifests (
    id              bigserial PRIMARY KEY,
    warehouse_id    int REFERENCES warehouses ON DELETE SET NULL,
    external_ref    text,
    status          manifest_status_enum DEFAULT 'draft',
    origin          jsonb,
    destination     jsonb,
    flight_no       text,
    eta             timestamptz,
    created_by      uuid REFERENCES accounts ON DELETE SET NULL,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);
CREATE INDEX idx_manifests_status ON manifests(status);
CREATE INDEX idx_manifests_warehouse_id ON manifests(warehouse_id);

CREATE TABLE manifest_items (
    id            bigserial PRIMARY KEY,
    manifest_id   bigint REFERENCES manifests ON DELETE CASCADE,
    sequence_no   int,
    tracking_no   text,
    description   text,
    pieces        int CHECK (pieces > 0),
    weight_kg     numeric CHECK (weight_kg >= 0),
    value_usd     numeric CHECK (value_usd >= 0),
    UNIQUE (manifest_id, tracking_no)
);
CREATE INDEX idx_manifest_items_tracking_no ON manifest_items(tracking_no);

CREATE TABLE manifest_merges (
    parent_manifest_id bigint REFERENCES manifests ON DELETE CASCADE,
    child_manifest_id  bigint REFERENCES manifests ON DELETE CASCADE,
    PRIMARY KEY (parent_manifest_id, child_manifest_id)
);

CREATE TABLE manifest_customs_xml (
    manifest_id bigint PRIMARY KEY REFERENCES manifests ON DELETE CASCADE,
    xml         text NOT NULL,
    created_at  timestamptz DEFAULT now()
);

-- =============== PACKAGES =================
CREATE TABLE packages (
    id                   bigserial PRIMARY KEY,
    tracking_no          text UNIQUE NOT NULL,
    manifest_id          bigint REFERENCES manifests ON DELETE SET NULL,
    customer_id          uuid REFERENCES accounts ON DELETE SET NULL,
    warehouse_id         int REFERENCES warehouses ON DELETE SET NULL,
    status               package_status_enum DEFAULT 'pre_alert',
    weight_kg            numeric CHECK (weight_kg >= 0),
    length_cm            numeric CHECK (length_cm >= 0),
    width_cm             numeric CHECK (width_cm >= 0),
    height_cm            numeric CHECK (height_cm >= 0),
    declared_value_usd   numeric CHECK (declared_value_usd >= 0),
    contents             text,
    current_zone         text,
    is_unknown           boolean DEFAULT false,
    temporary_id         text,
    received_at          timestamptz,
    cleared_at           timestamptz,
    created_at           timestamptz DEFAULT now(),
    updated_at           timestamptz DEFAULT now()
);
CREATE INDEX idx_packages_status ON packages(status);
CREATE INDEX idx_packages_customer_id ON packages(customer_id);
CREATE INDEX idx_packages_tracking_no ON packages(tracking_no);
CREATE INDEX idx_packages_temporary_id ON packages(temporary_id);

CREATE TABLE package_events (
    id          bigserial PRIMARY KEY,
    package_id  bigint REFERENCES packages ON DELETE CASCADE,
    event       text NOT NULL,
    details     jsonb,
    created_by  uuid REFERENCES accounts ON DELETE SET NULL,
    created_at  timestamptz DEFAULT now()
);
CREATE INDEX idx_package_events_package_id ON package_events(package_id);

CREATE TABLE package_contents (
    id          bigserial PRIMARY KEY,
    package_id  bigint REFERENCES packages ON DELETE CASCADE,
    sku         text,
    description text,
    qty         int CHECK (qty > 0),
    value_usd   numeric CHECK (value_usd >= 0)
);

CREATE TABLE package_images (
    id          bigserial PRIMARY KEY,
    package_id  bigint REFERENCES packages ON DELETE CASCADE,
    url         text NOT NULL,
    label       text,
    taken_at    timestamptz DEFAULT now()
);

-- =============== PRE-ALERTS =================
CREATE TABLE pre_alerts (
    id            bigserial PRIMARY KEY,
    customer_id   uuid REFERENCES accounts ON DELETE SET NULL,
    tracking_no   text NOT NULL,
    carrier       text,
    sender_name   text,
    sender_addr   jsonb,
    description   text,
    expected_date date,
    status        text DEFAULT 'submitted',
    created_at    timestamptz DEFAULT now()
);
CREATE INDEX idx_pre_alerts_tracking_no ON pre_alerts(tracking_no);

CREATE TABLE pre_alert_attachments (
    id           bigserial PRIMARY KEY,
    pre_alert_id bigint REFERENCES pre_alerts ON DELETE CASCADE,
    filename     text,
    url          text
);

-- =============== TALLY SHEETS =================
CREATE TABLE tally_sheets (
    id            bigserial PRIMARY KEY,
    warehouse_id  int REFERENCES warehouses ON DELETE SET NULL,
    manifest_id   bigint REFERENCES manifests ON DELETE SET NULL,
    created_by    uuid REFERENCES accounts ON DELETE SET NULL,
    status        text DEFAULT 'open',
    created_at    timestamptz DEFAULT now()
);
CREATE INDEX idx_tally_sheets_warehouse_id ON tally_sheets(warehouse_id);

CREATE TABLE tally_sheet_items (
    id               bigserial PRIMARY KEY,
    tally_sheet_id   bigint REFERENCES tally_sheets ON DELETE CASCADE,
    tracking_no      text,
    counted_qty      int CHECK (counted_qty >= 0),
    expected_qty     int CHECK (expected_qty >= 0),
    discrepancy_note text
);
CREATE INDEX idx_tally_sheet_items_tracking_no ON tally_sheet_items(tracking_no);

-- =============== CUSTOMS =================
CREATE TABLE customs_declarations (
    id                bigserial PRIMARY KEY,
    package_id        bigint REFERENCES packages ON DELETE SET NULL,
    declaration_no    text,
    status            text,
    submission_status text DEFAULT 'pending',
    external_ref      text,
    total_duty        numeric CHECK (total_duty >= 0),
    created_at        timestamptz DEFAULT now()
);
CREATE INDEX idx_customs_declarations_package_id ON customs_declarations(package_id);
CREATE INDEX idx_customs_declarations_submission_status
    ON customs_declarations(submission_status);

CREATE TABLE customs_declaration_items (
    id             bigserial PRIMARY KEY,
    declaration_id bigint REFERENCES customs_declarations ON DELETE CASCADE,
    hs_code        text,
    description    text,
    qty            int CHECK (qty > 0),
    value_usd      numeric CHECK (value_usd >= 0),
    duty_rate      numeric CHECK (duty_rate >= 0),
    duty_amount    numeric CHECK (duty_amount >= 0)
);

CREATE TABLE customs_documents (
    id            bigserial PRIMARY KEY,
    declaration_id bigint REFERENCES customs_declarations ON DELETE CASCADE,
    doc_type      text,
    file_url      text
);

-- =============== DELIVERIES =================
CREATE TABLE delivery_requests (
    id             bigserial PRIMARY KEY,
    address        jsonb,
    preferred_date date,
    notes          text,
    created_by     uuid REFERENCES accounts ON DELETE SET NULL,
    created_at     timestamptz DEFAULT now()
);

CREATE TABLE delivery_request_packages (
    delivery_request_id bigint REFERENCES delivery_requests ON DELETE CASCADE,
    package_id          bigint REFERENCES packages ON DELETE CASCADE,
    PRIMARY KEY (delivery_request_id, package_id)
);

CREATE TABLE delivery_schedules (
    id           bigserial PRIMARY KEY,
    request_id   bigint REFERENCES delivery_requests ON DELETE CASCADE,
    driver_id    uuid REFERENCES accounts ON DELETE SET NULL,
    vehicle      text,
    scheduled_at timestamptz,
    status       text DEFAULT 'scheduled'
);
CREATE INDEX idx_delivery_schedules_request_id ON delivery_schedules(request_id);

CREATE TABLE run_sheets (
    id             bigserial PRIMARY KEY,
    driver_id      uuid REFERENCES accounts ON DELETE SET NULL,
    vehicle        text,
    sheet_date     date,
    route_metadata jsonb,
    status         text DEFAULT 'open'
);
CREATE INDEX idx_run_sheets_driver_id ON run_sheets(driver_id);

CREATE TABLE run_sheet_stops (
    id           bigserial PRIMARY KEY,
    run_sheet_id bigint REFERENCES run_sheets ON DELETE CASCADE,
    schedule_id  bigint REFERENCES delivery_schedules ON DELETE CASCADE,
    sequence     int CHECK (sequence >= 0),
    arrived_at   timestamptz,
    completed_at timestamptz
);

CREATE TABLE delivery_attempts (
    id          bigserial PRIMARY KEY,
    schedule_id bigint REFERENCES delivery_schedules ON DELETE CASCADE,
    attempt_no  int CHECK (attempt_no > 0),
    result      delivery_result_enum,
    note        text,
    gps         point,
    image_url   text,
    created_at  timestamptz DEFAULT now()
);
CREATE INDEX idx_delivery_attempts_schedule_id ON delivery_attempts(schedule_id);

CREATE TABLE driver_gps_logs (
    id          bigserial PRIMARY KEY,
    driver_id   uuid REFERENCES accounts ON DELETE SET NULL,
    location    point,
    recorded_at timestamptz DEFAULT now()
);
CREATE INDEX idx_driver_gps_location ON driver_gps_logs USING GIST (location);
CREATE INDEX idx_driver_gps_driver_id ON driver_gps_logs(driver_id);

-- =============== FINANCIAL =================
CREATE TABLE rate_groups (
    id   serial PRIMARY KEY,
    name text UNIQUE NOT NULL
);

CREATE TABLE rate_cards (
    id            bigserial PRIMARY KEY,
    rate_group_id int REFERENCES rate_groups ON DELETE CASCADE,
    weight_start  numeric CHECK (weight_start >= 0),
    weight_end    numeric CHECK (weight_end >= weight_start),
    zone          text,
    price         numeric CHECK (price >= 0)
);

CREATE TABLE rate_overrides (
    id          bigserial PRIMARY KEY,
    customer_id uuid REFERENCES accounts ON DELETE SET NULL,
    package_id  bigint REFERENCES packages ON DELETE SET NULL,
    reason      text,
    price       numeric CHECK (price >= 0),
    created_by  uuid REFERENCES accounts ON DELETE SET NULL,
    created_at  timestamptz DEFAULT now()
);

CREATE TABLE invoices (
    id          bigserial PRIMARY KEY,
    customer_id uuid REFERENCES accounts ON DELETE SET NULL,
    invoice_no  text UNIQUE NOT NULL,
    amount_due  numeric CHECK (amount_due >= 0),
    amount_paid numeric DEFAULT 0 CHECK (amount_paid >= 0),
    status      text DEFAULT 'open',
    pdf_url     text,
    due_date    date,
    created_at  timestamptz DEFAULT now()
);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);

CREATE TABLE invoice_line_items (
    id         bigserial PRIMARY KEY,
    invoice_id bigint REFERENCES invoices ON DELETE CASCADE,
    description text,
    package_id bigint REFERENCES packages ON DELETE SET NULL,
    qty        numeric CHECK (qty > 0),
    unit_price numeric CHECK (unit_price >= 0),
    line_total numeric CHECK (line_total >= 0)
);

CREATE TABLE payments (
    id              bigserial PRIMARY KEY,
    invoice_id      bigint REFERENCES invoices ON DELETE CASCADE,
    external_txn_id text,
    amount          numeric CHECK (amount > 0),
    method          text,
    status          text DEFAULT 'pending',
    callback_url    text,
    paid_at         timestamptz DEFAULT now()
);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);

CREATE TABLE payment_attempts (
    id            bigserial PRIMARY KEY,
    payment_id    bigint REFERENCES payments ON DELETE CASCADE,
    attempt_no    int CHECK (attempt_no > 0),
    status        text,
    error         text,
    attempted_at  timestamptz DEFAULT now()
);

CREATE TABLE credit_account_limits (
    customer_id uuid PRIMARY KEY REFERENCES accounts ON DELETE CASCADE,
    limit_usd   numeric CHECK (limit_usd >= 0),
    updated_at  timestamptz DEFAULT now()
);

CREATE TABLE expenses (
    id          bigserial PRIMARY KEY,
    category    expense_category_enum,
    amount      numeric CHECK (amount >= 0),
    note        text,
    file_url    text,
    created_by  uuid REFERENCES accounts ON DELETE SET NULL,
    created_at  timestamptz DEFAULT now()
);

CREATE TABLE petty_cash_entries (
    id          bigserial PRIMARY KEY,
    amount      numeric CHECK (amount != 0),
    type        text CHECK (type IN ('expense', 'reimbursement')),
    note        text,
    approver_id uuid REFERENCES accounts ON DELETE SET NULL,
    created_at  timestamptz DEFAULT now()
);

-- =============== STORAGE FEES =================
CREATE TABLE storage_fee_charges (
    id         bigserial PRIMARY KEY,
    package_id bigint REFERENCES packages ON DELETE CASCADE,
    days_over  int CHECK (days_over >= 0),
    fee_usd    numeric CHECK (fee_usd >= 0),
    invoice_id bigint REFERENCES invoices ON DELETE SET NULL
);
CREATE INDEX idx_storage_fee_charges_package_id ON storage_fee_charges(package_id);

-- =============== COMMUNICATIONS =================
CREATE TABLE message_templates (
    id      serial PRIMARY KEY,
    name    text UNIQUE NOT NULL,
    subject text,
    body    text
);

CREATE TABLE message_batches (
    id          bigserial PRIMARY KEY,
    template_id int REFERENCES message_templates ON DELETE SET NULL,
    created_by  uuid REFERENCES accounts ON DELETE SET NULL,
    created_at  timestamptz DEFAULT now()
);

CREATE TABLE message_recipient (
    batch_id   bigint REFERENCES message_batches ON DELETE CASCADE,
    account_id uuid REFERENCES accounts ON DELETE CASCADE,
    status     text DEFAULT 'pending',
    PRIMARY KEY (batch_id, account_id)
);

CREATE TABLE notifications (
    id          bigserial PRIMARY KEY,
    account_id  uuid REFERENCES accounts ON DELETE SET NULL,
    channel     notification_channel_enum,
    title       text,
    body        text,
    data        jsonb,
    read_at     timestamptz,
    created_at  timestamptz DEFAULT now()
);
CREATE INDEX idx_notifications_account_id ON notifications(account_id);

CREATE TABLE notification_preferences (
    account_id uuid REFERENCES accounts ON DELETE CASCADE,
    event_type text NOT NULL,
    channel    notification_channel_enum NOT NULL,
    enabled    boolean DEFAULT true,
    PRIMARY KEY (account_id, event_type, channel)
);

CREATE TABLE chat_rooms (
    id          bigserial PRIMARY KEY,
    customer_id uuid REFERENCES accounts ON DELETE SET NULL,
    staff_id    uuid REFERENCES accounts ON DELETE SET NULL,
    created_at  timestamptz DEFAULT now()
);

CREATE TABLE chat_messages (
    id         bigserial PRIMARY KEY,
    room_id    bigint REFERENCES chat_rooms ON DELETE CASCADE,
    sender_id  uuid REFERENCES accounts ON DELETE SET NULL,
    message    text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_chat_messages_room_id ON chat_messages(room_id);

-- =============== QUICKBOOKS SYNC (kept; not Firebase) =================
CREATE TABLE quickbooks_sync (
    id             bigserial PRIMARY KEY,
    entity_type    text NOT NULL,
    entity_id      bigint NOT NULL,
    quickbooks_id  text,
    sync_status    text DEFAULT 'pending',
    last_synced_at timestamptz
);
CREATE INDEX idx_quickbooks_sync_entity ON quickbooks_sync(entity_type, entity_id);

-- =============== SYSTEM CONFIG =================
CREATE TABLE system_config (
    id         serial PRIMARY KEY,
    key        text UNIQUE NOT NULL,
    value      jsonb,
    updated_at timestamptz DEFAULT now()
);

-- =============== AUDIT & SYSTEM =================
CREATE TABLE audit_logs (
    id        bigserial PRIMARY KEY,
    actor_id  uuid REFERENCES accounts ON DELETE SET NULL,
    entity    text,
    entity_id text,
    action    text,
    diff      jsonb,
    ts        timestamptz DEFAULT now()
);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);

CREATE TABLE system_events (
    id      bigserial PRIMARY KEY,
    event   text,
    payload jsonb,
    ts      timestamptz DEFAULT now()
);
CREATE INDEX idx_system_events_event ON system_events(event);

-- =============== ROW LEVEL SECURITY =================
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_packages ON packages
    FOR SELECT
    USING (customer_id = current_setting('app.current_user_id')::uuid);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_invoices ON invoices
    FOR SELECT
    USING (customer_id = current_setting('app.current_user_id')::uuid);

-- =============== TRIGGERS FOR EFFICIENCY =================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_accounts_timestamp
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_packages_timestamp
    BEFORE UPDATE ON packages
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_invoices_timestamp
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE OR REPLACE FUNCTION validate_jsonb_address()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.address IS NOT NULL THEN
        IF NOT jsonb_typeof(NEW.address) = 'object' THEN
            RAISE EXCEPTION 'Address must be a JSON object';
        END IF;
        IF NOT NEW.address ? 'street' OR NOT NEW.address ? 'city'
           OR NOT NEW.address ? 'country' THEN
            RAISE EXCEPTION 'Address must contain street, city, and country';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER validate_warehouse_address
    BEFORE INSERT OR UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION validate_jsonb_address();

CREATE TRIGGER validate_delivery_request_address
    BEFORE INSERT OR UPDATE ON delivery_requests
    FOR EACH ROW EXECUTE FUNCTION validate_jsonb_address();

-- =============== LICENSE EXPIRATION NOTIFICATION FUNCTION =================
CREATE OR REPLACE FUNCTION notify_license_expiration()
RETURNS void AS $$
BEGIN
  INSERT INTO notifications (account_id, channel, title, body)
  SELECT NULL, 'email',
         'License Expiring Soon',
         'Warehouse license ' || license_no || ' expires on ' || expiry_date
  FROM warehouse_licenses
  WHERE expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    AND last_notification_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- =============== JWT REFRESH TOKENS TABLE =================
CREATE TABLE refresh_tokens (
    id          bigserial PRIMARY KEY,
    user_id     uuid REFERENCES accounts ON DELETE CASCADE,
    token       text UNIQUE NOT NULL,
    expires_at  timestamptz NOT NULL,
    is_active   boolean DEFAULT true,
    created_at  timestamptz DEFAULT now(),
    used_at     timestamptz
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- =============== PASSWORD RESET TOKENS TABLE =================
CREATE TABLE password_reset_tokens (
    id          bigserial PRIMARY KEY,
    user_id     uuid REFERENCES accounts ON DELETE CASCADE,
    token       text UNIQUE NOT NULL,
    expires_at  timestamptz NOT NULL,
    is_used     boolean DEFAULT false,
    created_at  timestamptz DEFAULT now(),
    used_at     timestamptz
);

CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

-- =============== EMAIL VERIFICATION TOKENS TABLE =================
CREATE TABLE email_verification_tokens (
    id          bigserial PRIMARY KEY,
    user_id     uuid REFERENCES accounts ON DELETE CASCADE,
    token       text UNIQUE NOT NULL,
    expires_at  timestamptz NOT NULL,
    is_used     boolean DEFAULT false,
    created_at  timestamptz DEFAULT now(),
    used_at     timestamptz
);

CREATE INDEX idx_email_verification_tokens_token ON email_verification_tokens(token);
CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);

-- =============== LOGIN ATTEMPTS TABLE (for security) =================
CREATE TABLE login_attempts (
    id          bigserial PRIMARY KEY,
    email       citext NOT NULL,
    ip_address  inet,
    user_agent  text,
    success     boolean NOT NULL,
    error_msg   text,
    attempted_at timestamptz DEFAULT now()
);

CREATE INDEX idx_login_attempts_email ON login_attempts(email);
CREATE INDEX idx_login_attempts_ip_address ON login_attempts(ip_address);
CREATE INDEX idx_login_attempts_attempted_at ON login_attempts(attempted_at);

-- =============== UPDATE ACCOUNTS TABLE =================
-- Remove firebase_uid column and update constraints
ALTER TABLE accounts DROP COLUMN IF EXISTS firebase_uid;


-- Add account status and verification fields
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_locked_at timestamptz;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS failed_login_attempts int DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS locked_until timestamptz;

-- =============== CLEANUP FUNCTIONS =================

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens() 
RETURNS void AS $$
BEGIN
    -- Clean up expired refresh tokens
    DELETE FROM refresh_tokens 
    WHERE expires_at < NOW() - INTERVAL '1 day';
    
    -- Clean up expired password reset tokens
    DELETE FROM password_reset_tokens 
    WHERE expires_at < NOW() - INTERVAL '1 day';
    
    -- Clean up expired email verification tokens
    DELETE FROM email_verification_tokens 
    WHERE expires_at < NOW() - INTERVAL '1 day';
    
    -- Clean up old login attempts (keep last 30 days)
    DELETE FROM login_attempts 
    WHERE attempted_at < NOW() - INTERVAL '30 days';
    
    RAISE NOTICE 'Expired tokens cleaned up successfully';
END;
$$ LANGUAGE plpgsql;

-- Function to handle account locking after failed attempts
CREATE OR REPLACE FUNCTION handle_failed_login(user_email citext) 
RETURNS void AS $$
DECLARE
    user_record record;
    max_attempts int := 5;
    lockout_duration interval := '15 minutes';
BEGIN
    -- Get user record
    SELECT * INTO user_record FROM accounts WHERE email = user_email;
    
    IF FOUND THEN
        -- Increment failed attempts
        UPDATE accounts 
        SET 
            failed_login_attempts = failed_login_attempts + 1,
            updated_at = NOW()
        WHERE email = user_email;
        
        -- Lock account if max attempts reached
        IF user_record.failed_login_attempts + 1 >= max_attempts THEN
            UPDATE accounts 
            SET 
                account_locked_at = NOW(),
                locked_until = NOW() + lockout_duration
            WHERE email = user_email;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to reset failed login attempts on successful login
CREATE OR REPLACE FUNCTION reset_failed_login_attempts(user_email citext) 
RETURNS void AS $$
BEGIN
    UPDATE accounts 
    SET 
        failed_login_attempts = 0,
        account_locked_at = NULL,
        locked_until = NULL,
        last_login_at = NOW()
    WHERE email = user_email;
END;
$$ LANGUAGE plpgsql;

-- Function to check if account is currently locked
CREATE OR REPLACE FUNCTION is_account_locked(user_email citext) 
RETURNS boolean AS $$
DECLARE
    user_record record;
BEGIN
    SELECT * INTO user_record FROM accounts WHERE email = user_email;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Check if account is locked and lock period hasn't expired
    IF user_record.account_locked_at IS NOT NULL AND 
       (user_record.locked_until IS NULL OR user_record.locked_until > NOW()) THEN
        RETURN true;
    END IF;
    
    -- If lock period has expired, unlock the account
    IF user_record.locked_until IS NOT NULL AND user_record.locked_until <= NOW() THEN
        PERFORM reset_failed_login_attempts(user_email);
    END IF;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- =============== TRIGGERS =================

-- Trigger to update timestamp on accounts
CREATE OR REPLACE FUNCTION update_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the existing trigger or create if not exists
DROP TRIGGER IF EXISTS update_accounts_timestamp ON accounts;
CREATE TRIGGER update_accounts_updated_at_trigger
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_accounts_updated_at();


-- Additional indexes for better performance
CREATE INDEX IF NOT EXISTS idx_accounts_email_active ON accounts(email) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_accounts_role_active ON accounts(role) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_accounts_locked_until ON accounts(locked_until) WHERE locked_until IS NOT NULL;