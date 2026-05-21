<?php

return [
    /*
     * SQLite database file. Relative paths are resolved from the project root.
     * Example for another server: 'data/production.sqlite'
     */
    'db_path' => 'data/printer-farm.sqlite',

    /*
     * Installation metadata file. Relative paths are resolved from the project root.
     */
    'install_file' => 'data/install.json',

    /*
     * First administrator account. On startup this admin is created or updated.
     * Use a strong password before deploying to another server.
     */
    'admin_name' => 'admin',
    'admin_email' => 'admin@example.local',
    'admin_password' => 'admin',
];
