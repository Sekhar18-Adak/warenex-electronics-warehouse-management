CREATE TABLE products (

    id INT UNSIGNED NOT NULL AUTO_INCREMENT,

    product_code VARCHAR(50) NOT NULL,

    name VARCHAR(255) NOT NULL,

    category VARCHAR(100) NOT NULL,

    brand VARCHAR(100) NOT NULL,

    model VARCHAR(100) DEFAULT NULL,

    description TEXT DEFAULT NULL,

    purchase_price DECIMAL(10,2) NOT NULL,

    selling_price DECIMAL(10,2) NOT NULL,

    current_stock INT NOT NULL DEFAULT 0,

    minimum_stock INT NOT NULL DEFAULT 5,

    unit VARCHAR(20) NOT NULL DEFAULT 'Piece',

    status VARCHAR(20) NOT NULL DEFAULT 'Active',

    created_by INT UNSIGNED NOT NULL,

    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uk_products_code (product_code),

    KEY idx_products_category (category),

    KEY idx_products_brand (brand),

    KEY idx_products_stock (current_stock),

    KEY idx_products_status (status),

    CONSTRAINT chk_products_status
        CHECK (
            status IN (
                'Active',
                'Inactive',
                'Discontinued'
            )
        ),

    CONSTRAINT fk_products_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;