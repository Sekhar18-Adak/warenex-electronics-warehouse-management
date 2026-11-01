CREATE TABLE reports (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    report_code VARCHAR(30) NOT NULL,
    title VARCHAR(200) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
    description TEXT NOT NULL,
    attachment_path VARCHAR(500) NULL,

    submitted_by INT UNSIGNED NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'Submitted',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uk_report_code (report_code),
    KEY idx_report_status (status),
    KEY idx_report_type (report_type),
    KEY idx_report_submitted_by (submitted_by),
    KEY idx_report_created_at (created_at),

    CONSTRAINT chk_report_priority
        CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),

    CONSTRAINT chk_report_status
        CHECK (status IN ('Submitted', 'Under Review', 'Resolved', 'Rejected')),

    CONSTRAINT fk_report_submitted_by
        FOREIGN KEY (submitted_by)
        REFERENCES users(id)
        ON DELETE RESTRICT
);
