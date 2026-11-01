CREATE TABLE suppliers (

    id INT UNSIGNED NOT NULL AUTO_INCREMENT,

    supplier_code VARCHAR(20) NOT NULL,

    supplier_name VARCHAR(150) NOT NULL,

    contact_person VARCHAR(100) NOT NULL,

    phone VARCHAR(20) NOT NULL,

    email VARCHAR(255) DEFAULT NULL,

    gst_number VARCHAR(50) DEFAULT NULL,

    address TEXT,

    city VARCHAR(100),

    state VARCHAR(100),

    postal_code VARCHAR(20),

    status VARCHAR(20) NOT NULL DEFAULT 'Active',

    created_by INT UNSIGNED NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uk_supplier_code (supplier_code),

    UNIQUE KEY uk_supplier_phone (phone),

    KEY idx_supplier_status (status),

    CONSTRAINT chk_supplier_status
        CHECK (status IN ('Active','Inactive')),

    CONSTRAINT fk_supplier_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;