CREATE TABLE notifications (

    id INT UNSIGNED NOT NULL AUTO_INCREMENT,

    sender_id INT UNSIGNED NOT NULL,

    receiver_id INT UNSIGNED NOT NULL,

    title VARCHAR(255) NOT NULL,

    message TEXT NOT NULL,

    type VARCHAR(30) NOT NULL,

    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_receiver (receiver_id),
    KEY idx_read (is_read),

    CONSTRAINT fk_notification_sender
        FOREIGN KEY (sender_id)
        REFERENCES users(id),

    CONSTRAINT fk_notification_receiver
        FOREIGN KEY (receiver_id)
        REFERENCES users(id)

);