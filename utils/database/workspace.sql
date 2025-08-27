-- Base Tables
CREATE TABLE IF NOT EXISTS jobs (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    job_data JSONB,
    assemblies JSONB,
    nests JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    modified_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nests (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    sheet JSONB,
    laser_cut_parts JSONB,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    modified_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nest_laser_cut_parts (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    nest_id INTEGER NOT NULL REFERENCES nests(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    inventory_data JSONB,
    meta_data JSONB,
    prices JSONB,
    paint_data JSONB,
    primer_data JSONB,
    powder_data JSONB,
    workspace_data JSONB,
    changed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    modified_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assemblies (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES assemblies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    flowtag TEXT [] NOT NULL,
    flowtag_index INTEGER NOT NULL DEFAULT 0,
    flowtag_status_index INTEGER NOT NULL DEFAULT 0,
    is_timing BOOLEAN NOT NULL DEFAULT false,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    meta_data JSONB,
    prices JSONB,
    paint_data JSONB,
    primer_data JSONB,
    powder_data JSONB,
    workspace_data JSONB,
    changed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    modified_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recut_laser_cut_parts (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    flowtag TEXT [] NOT NULL,
    recut_reason TEXT,
    inventory_data JSONB,
    meta_data JSONB,
    prices JSONB,
    paint_data JSONB,
    primer_data JSONB,
    powder_data JSONB,
    workspace_data JSONB,
    changed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    modified_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assembly_laser_cut_parts (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    assembly_id BIGINT NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    flowtag TEXT [] NOT NULL,
    flowtag_index INTEGER NOT NULL DEFAULT 0,
    flowtag_status_index INTEGER NOT NULL DEFAULT 0,
    recut BOOLEAN NOT NULL DEFAULT false,
    recoat BOOLEAN NOT NULL DEFAULT false,
    is_timing BOOLEAN NOT NULL DEFAULT false,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    inventory_data JSONB,
    meta_data JSONB,
    prices JSONB,
    paint_data JSONB,
    primer_data JSONB,
    powder_data JSONB,
    workspace_data JSONB,
    changed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    modified_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS part_status_timeline (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    part_id BIGINT NOT NULL REFERENCES assembly_laser_cut_parts(id) ON DELETE SET NULL,
    flowtag TEXT [] NOT NULL,
    flowtag_index INTEGER NOT NULL,
    flowtag_name TEXT NOT NULL,
    flowtag_status_index INTEGER NOT NULL,
    recut BOOLEAN NOT NULL,
    recoat BOOLEAN NOT NULL,
    is_timing BOOLEAN NOT NULL,
    changed_by TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS components (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    assembly_id BIGINT NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    modified_at TIMESTAMPTZ DEFAULT now()
);

-- Notification Trigger for jobs
CREATE
OR REPLACE FUNCTION notify_job_change() RETURNS trigger AS $$ BEGIN PERFORM pg_notify(
    'jobs',
    json_build_object(
        'type',
        TG_OP,
        'table',
        TG_TABLE_NAME,
        'job_id',
        COALESCE(NEW.id, OLD.id)
    ) :: text
);

RETURN COALESCE(NEW, OLD);

END;

$$ LANGUAGE plpgsql;

CREATE
OR REPLACE TRIGGER job_event_trigger
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON jobs FOR EACH ROW EXECUTE FUNCTION notify_job_change();

-- Notification Trigger for laser cut parts
-- Auto-updated grouping view per job
CREATE OR REPLACE VIEW view_grouped_laser_cut_parts_by_job AS
WITH latest_data AS (
    SELECT DISTINCT ON (name)
        name,
        meta_data::jsonb AS meta_data,
        workspace_data::jsonb AS workspace_data
    FROM assembly_laser_cut_parts
    ORDER BY name, modified_at DESC
)
SELECT
    MIN(w.id) AS group_id,
    w.job_id,
    w.name,
    w.flowtag,
    w.flowtag_index,
    w.flowtag_status_index,
    w.recut,
    w.recoat,
    w.is_timing,
    w.flowtag[w.flowtag_index + 1] AS current_flowtag,
    (w.flowtag_index = cardinality(w.flowtag)) AS is_completed,
    COUNT(*) AS quantity,
    MIN(w.start_time) AS start_time,
    MAX(w.end_time) AS end_time,
    ld.meta_data::jsonb,
    ld.workspace_data::jsonb,
    MIN(w.created_at) AS created_at,
    MAX(w.modified_at) AS modified_at
FROM
    assembly_laser_cut_parts w
JOIN
    latest_data ld ON ld.name = w.name
GROUP BY
    w.job_id,
    w.name,
    w.flowtag,
    w.flowtag_index,
    w.flowtag_status_index,
    w.recut,
    w.recoat,
    w.is_timing,
    w.start_time,
    w.end_time,
    ld.meta_data,
    ld.workspace_data;

-- Notification function for laser cut parts view changes
CREATE OR REPLACE FUNCTION notify_laser_cut_parts_view_change()
RETURNS trigger AS $$
BEGIN
    -- Notify for the job-specific view
    PERFORM pg_notify(
        'view_grouped_laser_cut_parts_by_job',
        json_build_object(
            'type', TG_OP,
            'table', TG_TABLE_NAME,
            'job_id', COALESCE(NEW.job_id, OLD.job_id),
            'part_name', COALESCE(NEW.name, OLD.name),
            'flowtag', COALESCE(NEW.flowtag, OLD.flowtag),
            'flowtag_index', COALESCE(NEW.flowtag_index, OLD.flowtag_index),
            'flowtag_status_index', COALESCE(NEW.flowtag_status_index, OLD.flowtag_status_index),
            'recut', COALESCE(NEW.recut, OLD.recut),
            'recoat', COALESCE(NEW.recoat, OLD.recoat),
            'start_time', COALESCE(NEW.start_time, OLD.start_time),
            'end_time', COALESCE(NEW.end_time, OLD.end_time),
            'is_timing', COALESCE(NEW.is_timing, OLD.is_timing)
        )::text
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger on the underlying table
CREATE OR REPLACE TRIGGER laser_cut_parts_view_event_trigger
    AFTER INSERT OR UPDATE OR DELETE
    ON assembly_laser_cut_parts
    FOR EACH ROW
    EXECUTE FUNCTION notify_laser_cut_parts_view_change();

CREATE OR REPLACE FUNCTION log_part_status_timeline()
RETURNS TRIGGER AS $$
BEGIN
    -- If part is complete, close any open timeline and exit
    IF NEW.flowtag_index = cardinality(NEW.flowtag) THEN
        UPDATE part_status_timeline
        SET ended_at = now()
        WHERE part_id = OLD.id
          AND ended_at IS NULL;
        RETURN NEW;
    END IF;

    -- Otherwise, log state change
    IF OLD.flowtag_index IS DISTINCT FROM NEW.flowtag_index
       OR OLD.flowtag_status_index IS DISTINCT FROM NEW.flowtag_status_index
       OR OLD.recut IS DISTINCT FROM NEW.recut
       OR OLD.recoat IS DISTINCT FROM NEW.recoat
       OR OLD.is_timing IS DISTINCT FROM NEW.is_timing
    THEN
        -- Close old state
        UPDATE part_status_timeline
        SET ended_at = now()
        WHERE part_id = OLD.id
          AND ended_at IS NULL;

        -- Insert new state
        INSERT INTO part_status_timeline (
            part_id,
            name,
            flowtag,
            flowtag_index,
            flowtag_name,
            flowtag_status_index,
            recut,
            recoat,
            is_timing,
            changed_by,
            started_at
        )
        VALUES (
            OLD.id,
            OLD.name,
            NEW.flowtag,
            NEW.flowtag_index,
            NEW.flowtag[NEW.flowtag_index + 1],
            NEW.flowtag_status_index,
            NEW.recut,
            NEW.recoat,
            NEW.is_timing,
            NEW.changed_by,
            now()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_part_status_timeline
    AFTER UPDATE ON assembly_laser_cut_parts
    FOR EACH ROW
    EXECUTE FUNCTION log_part_status_timeline();

CREATE OR REPLACE VIEW part_full_duration AS
SELECT
    part_id,
    name,
    MIN(started_at) AS first_seen,
    MAX(COALESCE(ended_at, now())) AS last_seen,
    AGE(MAX(COALESCE(ended_at, now())), MIN(started_at)) AS total_duration
FROM part_status_timeline
GROUP BY part_id, name;

CREATE OR REPLACE VIEW part_intervals AS
SELECT
    id AS timeline_id,
    part_id,
    name,
    recut,
    recoat,
    is_timing,
    flowtag_index,
    flowtag_name,
    flowtag_status_index,
    started_at,
    ended_at,
    COALESCE(ended_at, now()) - started_at AS duration
FROM part_status_timeline
ORDER BY part_id, started_at;

CREATE OR REPLACE VIEW part_state_summary AS
SELECT
    part_id,
    name,
    recut,
    recoat,
    is_timing,
    flowtag_index,
    flowtag_name,
    SUM(COALESCE(ended_at, now()) - started_at) AS total_duration,
    COUNT(*) AS transitions
FROM part_status_timeline
GROUP BY part_id, name, recut, recoat, is_timing, flowtag_index, flowtag_name
ORDER BY part_id, total_duration DESC;

-- CREATE OR REPLACE VIEW part_state_summary AS
-- SELECT
--     part_id,
--     name,
--     recut,
--     recoat,
--     flowtag_index,
--     flowtag_name,
--     MIN(started_at) AS first_seen,
--     MAX(COALESCE(ended_at, now())) AS last_seen,
--     AGE(MAX(COALESCE(ended_at, now())), MIN(started_at)) AS duration
-- FROM part_status_timeline
-- GROUP BY part_id, name, recut, recoat, flowtag_index, flowtag_name
-- ORDER BY part_id, first_seen;