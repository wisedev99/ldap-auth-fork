require('dotenv').config(); // Load environment variables from a .env file
const mysql = require('mysql');
const bodyParser = require('body-parser');


const express = require('express');
const ldapauth = require('ldapauth-fork');

const dbOptions = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
};

const app = express();
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// MYSQL server configuration settings for production use only
// dbConnection.connect((err) => {
//     if (err) {
//         console.error('Error connecting to database:', err);
//     } else {
//         console.log('Connected to database!');
//     }
// });

// MySQL connection pool

const pool = mysql.createPool(dbOptions);


// LDAP server configuration
const ldapOptions = {
    url: 'ldap://ldap.forumsys.com:389',
    bindDN: 'cn=read-only-admin,dc=example,dc=com',
    bindCredentials: 'password',
    searchBase: 'dc=example,dc=com',
    searchFilter: '(uid={{username}})'
};


// Initialize LDAP authentication
const ldap = new ldapauth(ldapOptions);



// LDAP authentication middleware
const authenticate = (username, password, done) => {
    ldap.authenticate(username, password, (err, user) => {
        if (err) {
            done(err);
        } else if (user) {
            done(null, user); // Authentication successful, pass the user object
            console.log('Authentication failed', user);
            // insert or update the user object into the database and pass the user object into the middleware function
            pool.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
                if (err) {
                    done(err);
                } else {
                    if (results.length > 0) {
                        // User exists, update their information in the database
                        pool.query(`UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?`, [password, username], (err) => {
                            if (err) {
                                done(err);
                            } else {
                                done(null, user);
                            }
                        });
                    } else {
                        // User doesn't exist, add them to the database
                        pool.query('INSERT INTO users (fullname, username, password, mail) VALUES (?, ?, ?, ?)', [user.cn, user.uid, password, user.mail], (err) => {
                            if (err) {
                                done(err);
                            } else {
                                done(null, user);
                            }
                        });
                    }
                }
            });

        } else {
            done(new Error('Invalid username or password'));
        }
    });
};

// API route for authentication
app.post('/auth', (req, res) => {
    const { username, password } = req.body;
    authenticate(username, password, (err, user) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ message: 'Authenticated successfully!', user });
        }
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
