-- Base Tables
CREATE TABLE IF NOT EXISTS workspace_jobs (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    job_data JSONB,
    assemblies JSONB,
    nests JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    modified_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_nests (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES workspace_jobs(id) ON DELETE CASCADE,
    sheet JSONB,
    laser_cut_parts JSONB,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    modified_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_nest_laser_cut_parts (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES workspace_jobs(id) ON DELETE CASCADE,
    nest_id INTEGER NOT NULL REFERENCES workspace_nests(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    setup_time JSONB,
    setup_time_seconds INTEGER,
    process_time JSONB,
    process_time_seconds INTEGER,
    automated_time JSONB,
    automated_time_seconds INTEGER,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    inventory_data JSONB,
    meta_data JSONB,
    prices JSONB,
    paint_data JSONB,
    primer_data JSONB,
    powder_data JSONB,
    workspace_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    modified_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_assemblies (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES workspace_jobs(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES workspace_assemblies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    flowtag TEXT [] NOT NULL,
    flowtag_index INTEGER NOT NULL DEFAULT 0,
    setup_time JSONB,
    setup_time_seconds INTEGER,
    process_time JSONB,
    process_time_seconds INTEGER,
    automated_time JSONB,
    automated_time_seconds INTEGER,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    meta_data JSONB,
    prices JSONB,
    paint_data JSONB,
    primer_data JSONB,
    powder_data JSONB,
    workspace_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    modified_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_assembly_laser_cut_parts (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES workspace_jobs(id) ON DELETE CASCADE,
    assembly_id INTEGER NOT NULL REFERENCES workspace_assemblies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    flowtag TEXT [] NOT NULL,
    flowtag_index INTEGER NOT NULL DEFAULT 0,
    setup_time JSONB,
    setup_time_seconds INTEGER,
    process_time JSONB,
    process_time_seconds INTEGER,
    automated_time JSONB,
    automated_time_seconds INTEGER,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    inventory_data JSONB,
    meta_data JSONB,
    prices JSONB,
    paint_data JSONB,
    primer_data JSONB,
    powder_data JSONB,
    workspace_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    modified_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_components (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES workspace_jobs(id) ON DELETE CASCADE,
    assembly_id INTEGER,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    modified_at TIMESTAMPTZ DEFAULT now()
);

-- Notification Trigger for workspace_jobs
CREATE
OR REPLACE FUNCTION notify_job_change() RETURNS trigger AS $$ BEGIN PERFORM pg_notify(
    'workspace_jobs',
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
    OR DELETE ON workspace_jobs FOR EACH ROW EXECUTE FUNCTION notify_job_change();

-- Notification Trigger for laser cut parts
-- Auto-updated grouping view per job
CREATE OR REPLACE VIEW view_grouped_laser_cut_parts_by_job AS
WITH latest_data AS (
    SELECT DISTINCT ON (name)
        name,
        meta_data::jsonb AS meta_data,
        workspace_data::jsonb AS workspace_data
    FROM workspace_assembly_laser_cut_parts
    ORDER BY name, modified_at DESC
)
SELECT
    MIN(w.id) AS group_id,
    w.job_id,
    w.name,
    w.flowtag,
    w.flowtag_index,
    w.flowtag[w.flowtag_index + 1] AS current_flowtag,
    (w.flowtag_index + 1 = cardinality(w.flowtag)) AS is_completed,
    COUNT(*) AS quantity,
    ld.meta_data::jsonb,
    ld.workspace_data::jsonb,
    MIN(w.created_at) AS created_at,
    MAX(w.modified_at) AS modified_at
FROM
    workspace_assembly_laser_cut_parts w
JOIN
    latest_data ld ON ld.name = w.name
GROUP BY
    w.job_id,
    w.name,
    w.flowtag,
    w.flowtag_index,
    ld.meta_data,
    ld.workspace_data;

CREATE OR REPLACE VIEW view_grouped_laser_cut_parts_global AS
WITH latest_data AS (
    SELECT DISTINCT ON (name)
        name,
        meta_data::jsonb AS meta_data,
        workspace_data::jsonb AS workspace_data
    FROM workspace_assembly_laser_cut_parts
    ORDER BY name, modified_at DESC
)
SELECT
    MIN(w.id) AS group_id,
    w.name,
    w.flowtag,
    w.flowtag_index,
    w.flowtag[w.flowtag_index + 1] AS current_flowtag,
    (w.flowtag_index + 1 = cardinality(w.flowtag)) AS is_completed,
    COUNT(*) AS quantity,
    ld.meta_data::jsonb,
    ld.workspace_data::jsonb,
    MIN(w.created_at) AS created_at,
    MAX(w.modified_at) AS modified_at
FROM
    workspace_assembly_laser_cut_parts w
JOIN
    latest_data ld ON ld.name = w.name
GROUP BY
    w.name,
    w.flowtag,
    w.flowtag_index,
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
            'flowtag_index', COALESCE(NEW.flowtag_index, OLD.flowtag_index)
        )::text
    );

    -- Notify for the global view
    PERFORM pg_notify(
        'view_grouped_laser_cut_parts_global',
        json_build_object(
            'type', TG_OP,
            'table', TG_TABLE_NAME,
            'part_name', COALESCE(NEW.name, OLD.name),
            'flowtag', COALESCE(NEW.flowtag, OLD.flowtag),
            'flowtag_index', COALESCE(NEW.flowtag_index, OLD.flowtag_index)
        )::text
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger on the underlying table
CREATE OR REPLACE TRIGGER laser_cut_parts_view_event_trigger
    AFTER INSERT OR UPDATE OR DELETE
    ON workspace_assembly_laser_cut_parts
    FOR EACH ROW
    EXECUTE FUNCTION notify_laser_cut_parts_view_change();