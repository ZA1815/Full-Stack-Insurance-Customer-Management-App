require('dotenv').config();
const express = require('express');
const sql = require('mssql');
const bcrypt = require('bcrypt');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'EmployeePortal',
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: true
    }
};

let pool;

async function initDatabase() {
    try {
        pool = await sql.connect(dbConfig);
        console.log('Connected to MS SQL Server');
        await createTables();
    } catch (err) {
        console.error('Database connection failed:', err);
        process.exit(1);
    }
}

async function createTables() {
    try {
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='employees' AND xtype='U')
            CREATE TABLE employees (
                id INT IDENTITY(1,1) PRIMARY KEY,
                username NVARCHAR(50) UNIQUE NOT NULL,
                password_hash NVARCHAR(255) NOT NULL,
                full_name NVARCHAR(100) NOT NULL,
                email NVARCHAR(100),
                is_active BIT DEFAULT 1
            )
        `);

        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='customers' AND xtype='U')
            CREATE TABLE customers (
                id INT IDENTITY(1,1) PRIMARY KEY,
                source NVARCHAR(100) NOT NULL, name_insured NVARCHAR(200) NOT NULL,
                contact_person NVARCHAR(200) NOT NULL, phone_number NVARCHAR(20) NOT NULL,
                address NTEXT NOT NULL, email NVARCHAR(100) NOT NULL,
                policy_number NVARCHAR(50) UNIQUE NOT NULL, carrier NVARCHAR(100) NOT NULL,
                premium DECIMAL(10,2) NOT NULL, effective_date DATE NOT NULL,
                expiration_date DATE NOT NULL, alert NVARCHAR(20) NOT NULL,
                product NVARCHAR(100) NOT NULL, status NVARCHAR(20) NOT NULL,
                reference NVARCHAR(100), additional_comments NTEXT,
                created_at DATETIME2 DEFAULT GETDATE(), updated_at DATETIME2 DEFAULT GETDATE(),
                created_by NVARCHAR(50) NOT NULL, last_modified_by NVARCHAR(50) NOT NULL
            )
        `);

        const adminExists = await pool.request()
            .input('username', sql.NVarChar, 'admin')
            .query('SELECT COUNT(*) as count FROM employees WHERE username = @username');

        if (adminExists.recordset[0].count === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await pool.request()
                .input('username', sql.NVarChar, 'admin')
                .input('password_hash', sql.NVarChar, hashedPassword)
                .input('full_name', sql.NVarChar, 'System Administrator')
                .query(`INSERT INTO employees (username, password_hash, full_name) VALUES (@username, @password_hash, @full_name)`);
            console.log('Default admin user created.');
        }
    } catch (err) {
        console.error('Error creating tables:', err);
    }
}

function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    } else {
        return res.status(401).json({ message: 'Unauthorized. Please log in.' });
    }
}

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .query('SELECT * FROM employees WHERE username = @username AND is_active = 1');

        if (result.recordset.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const employee = result.recordset[0];
        const isValid = await bcrypt.compare(password, employee.password_hash);

        if (!isValid) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        req.session.user = {
            id: employee.id,
            username: employee.username,
            full_name: employee.full_name
        };

        res.json({ success: true, employee: req.session.user });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Could not log out.' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logged out successfully.' });
    });
});

app.get('/api/customers', requireAuth, async (req, res) => {
    try {
        const { search, searchField } = req.query;
        let query = 'SELECT * FROM customers';
        const request = pool.request();
        
        if (search && (searchField === 'name' || searchField === 'policy')) {
            const field = searchField === 'name' ? 'name_insured' : 'policy_number';
            query += ` WHERE ${field} LIKE @search`;
            request.input('search', sql.NVarChar, `%${search}%`);
        }
        query += ' ORDER BY updated_at DESC';

        const result = await request.query(query);
        res.json({ success: true, customers: result.recordset });
    } catch (err) {
        res.status(500).json({ message: 'Failed to retrieve customers.' });
    }
});

app.post('/api/customers', requireAuth, async (req, res) => {
    try {
        const c = req.body;
        const result = await pool.request()
            .input('source', sql.NVarChar, c.source).input('name_insured', sql.NVarChar, c.name_insured)
            .input('contact_person', sql.NVarChar, c.contact_person).input('phone_number', sql.NVarChar, c.phone_number)
            .input('address', sql.NText, c.address).input('email', sql.NVarChar, c.email)
            .input('policy_number', sql.NVarChar, c.policy_number).input('carrier', sql.NVarChar, c.carrier)
            .input('premium', sql.Decimal(10, 2), c.premium).input('effective_date', sql.Date, c.effective_date)
            .input('expiration_date', sql.Date, c.expiration_date).input('alert', sql.NVarChar, c.alert)
            .input('product', sql.NVarChar, c.product).input('status', sql.NVarChar, c.status)
            .input('reference', sql.NVarChar, c.reference).input('additional_comments', sql.NText, c.additional_comments)
            .input('created_by', sql.NVarChar, req.session.user.username)
            .input('last_modified_by', sql.NVarChar, req.session.user.username)
            .query(`INSERT INTO customers (source, name_insured, contact_person, phone_number, address, email, policy_number, carrier, premium, effective_date, expiration_date, alert, product, status, reference, additional_comments, created_by, last_modified_by)
                    OUTPUT INSERTED.id
                    VALUES (@source, @name_insured, @contact_person, @phone_number, @address, @email, @policy_number, @carrier, @premium, @effective_date, @expiration_date, @alert, @product, @status, @reference, @additional_comments, @created_by, @last_modified_by)`);
        
        res.status(201).json({ success: true, message: 'Customer created successfully', customerId: result.recordset[0].id });
    } catch (err) {
        // SQL Server error 2627 is duplicate key constraint
        if (err.number === 2627) {
            return res.status(400).json({ message: 'Policy number already exists.' });
        }
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.put('/api/customers/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const c = req.body;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('source', sql.NVarChar, c.source).input('name_insured', sql.NVarChar, c.name_insured)
            .input('contact_person', sql.NVarChar, c.contact_person).input('phone_number', sql.NVarChar, c.phone_number)
            .input('address', sql.NText, c.address).input('email', sql.NVarChar, c.email)
            .input('policy_number', sql.NVarChar, c.policy_number).input('carrier', sql.NVarChar, c.carrier)
            .input('premium', sql.Decimal(10, 2), c.premium).input('effective_date', sql.Date, c.effective_date)
            .input('expiration_date', sql.Date, c.expiration_date).input('alert', sql.NVarChar, c.alert)
            .input('product', sql.NVarChar, c.product).input('status', sql.NVarChar, c.status)
            .input('reference', sql.NVarChar, c.reference).input('additional_comments', sql.NText, c.additional_comments)
            .input('last_modified_by', sql.NVarChar, req.session.user.username)
            .query(`UPDATE customers SET source = @source, name_insured = @name_insured, contact_person = @contact_person, phone_number = @phone_number, address = @address, email = @email, policy_number = @policy_number, carrier = @carrier, premium = @premium, effective_date = @effective_date, expiration_date = @expiration_date, alert = @alert, product = @product, status = @status, reference = @reference, additional_comments = @additional_comments, last_modified_by = @last_modified_by, updated_at = GETDATE() WHERE id = @id`);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'Customer not found.' });
        }
        res.json({ success: true, message: 'Customer updated successfully.' });
    } catch (err) {
        if (err.number === 2627) {
            return res.status(400).json({ message: 'Policy number already exists.' });
        }
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.delete('/api/customers/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM customers WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'Customer not found.' });
        }
        res.json({ success: true, message: 'Customer deleted successfully.' });
    } catch (err) {
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
});