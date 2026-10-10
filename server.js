const express = require("express");
const mongoose = require("mongoose");
const core = require("cors");

const app = express();


// =====================================================
// MIDDLEWARE
// =====================================================

app.use(express.static("public"));
app.use(core());
app.use(express.json());


// =====================================================
// MONGODB CONNECTION
// =====================================================

mongoose
    .connect("mongodb://127.0.0.1:27017/CustomerDB")
    .then(() => {
        console.log("MongoDB Connected");
    })
    .catch((error) => {
        console.error("MongoDB Connection Error:", error);
    });


// =====================================================
// CUSTOMER SCHEMA
// =====================================================

const CustomerSchema = new mongoose.Schema({

    name: {
        type: String,
        required: [true, "Name is required"],
        trim: true,
        minlength: [2, "Name must contain at least 2 characters"],
        match: [
            /^[A-Za-z ]+$/,
            "Name can contain only letters and spaces"
        ]
    },

    email: {
        type: String,
        required: [true, "Email is required"],
        trim: true,
        lowercase: true,
        match: [
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            "Please enter a valid email address"
        ],
        unique: true
    },

    phone: {
        type: String,
        required: [true, "Phone number is required"],
        match: [
            /^[0-9]{10}$/,
            "Phone number must contain exactly 10 digits"
        ],
        unique: true
    }

});

const Customer = mongoose.model("Customer", CustomerSchema);
// =====================================================
// TRANSACTION SCHEMA
// =====================================================

const TransactionSchema = new mongoose.Schema({

    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        required: [true, "Customer ID is required"]
    },

    amount: {
        type: Number,
        required: [true, "Transaction amount is required"],
        min: [1, "Transaction amount must be greater than 0"]
    },

    product: {
        type: String,
        required: [true, "Product name is required"],
        trim: true
    },

    transactionDate: {
        type: Date,
        required: [true, "Transaction date is required"],
        default: Date.now
    }

});

const Transaction = mongoose.model(
    "Transaction",
    TransactionSchema
);

// =====================================================
// 1. GET ALL CUSTOMERS
// =====================================================

app.get("/customers", async (req, res) => {

    try {

        const customers = await Customer.find();

        res.json(customers);

    } catch (error) {

        res.status(500).json({
            success: false,
            message: "Could not fetch customers"
        });

    }

});


// =====================================================
// 2. SEARCH CUSTOMERS
// =====================================================

app.get("/customers/search", async (req, res) => {

    try {

        const { name, email, phone } = req.query;

        const filter = {};

        // Search by name
        if (name) {

            filter.name = {
                $regex: name,
                $options: "i"
            };

        }

        // Search by email
        if (email) {

            filter.email = {
                $regex: email,
                $options: "i"
            };

        }

        // Search by phone
        if (phone) {

            filter.phone = {
                $regex: phone
            };

        }

        const customers = await Customer.find(filter);

        res.json({
            success: true,
            count: customers.length,
            customers: customers
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: "Could not search customers"
        });

    }

});


// =====================================================
// 3. GET CUSTOMER BY ID
// =====================================================

app.get("/customers/:id", async (req, res) => {

    try {

        const customer = await Customer.findById(
            req.params.id
        );

        if (!customer) {

            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });

        }

        res.json({
            success: true,
            customer: customer
        });

    } catch (error) {

        res.status(400).json({
            success: false,
            message: "Invalid customer ID"
        });

    }

});


// =====================================================
// 4. ADD CUSTOMER
// =====================================================

app.post("/customers", async (req, res) => {

    try {

        const customer = new Customer(req.body);

        const savedCustomer = await customer.save();

        res.status(201).json({
            success: true,
            message: "Customer added successfully",
            customer: savedCustomer
        });

    } catch (error) {

        // Duplicate email or phone
        if (error.code === 11000) {

            const field = Object.keys(error.keyPattern)[0];

            return res.status(400).json({
                success: false,
                message: `${field} already exists`
            });

        }

        // Validation errors
        if (error.name === "ValidationError") {

            const messages = Object.values(error.errors)
                .map(err => err.message);

            return res.status(400).json({
                success: false,
                message: messages.join(", ")
            });

        }

        // Other errors
        res.status(500).json({
            success: false,
            message: "Server error"
        });

    }

});


// =====================================================
// 5. UPDATE CUSTOMER
// =====================================================

app.put("/customers/:id", async (req, res) => {

    try {

        const customer = await Customer.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        if (!customer) {

            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });

        }

        res.json({
            success: true,
            message: "Customer updated successfully",
            customer: customer
        });

    } catch (error) {

        // Duplicate email or phone
        if (error.code === 11000) {

            const field = Object.keys(error.keyPattern)[0];

            return res.status(400).json({
                success: false,
                message: `${field} already exists`
            });

        }

        // Validation errors
        if (error.name === "ValidationError") {

            const messages = Object.values(error.errors)
                .map(err => err.message);

            return res.status(400).json({
                success: false,
                message: messages.join(", ")
            });

        }

        // Other errors
        res.status(500).json({
            success: false,
            message: "Server error"
        });

    }

});


// =====================================================
// 6. DELETE CUSTOMER
// =====================================================

app.delete("/customers/:id", async (req, res) => {

    try {

        const customer = await Customer.findByIdAndDelete(
            req.params.id
        );

        if (!customer) {

            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });

        }

        res.json({
            success: true,
            message: "Customer deleted successfully"
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: "Server error"
        });

    }

});
// =====================================================
// ADD TRANSACTION
// =====================================================

app.post("/transactions", async (req, res) => {

    try {

        const { customerId, amount, product, transactionDate } = req.body;

        // Check whether customer exists
        const customer = await Customer.findById(customerId);

        if (!customer) {

            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });

        }

        const transaction = new Transaction({
            customerId,
            amount,
            product,
            transactionDate
        });

        const savedTransaction = await transaction.save();

        res.status(201).json({
            success: true,
            message: "Transaction added successfully",
            transaction: savedTransaction
        });

    } catch (error) {

        // Validation errors
        if (error.name === "ValidationError") {

            const messages = Object.values(error.errors)
                .map(err => err.message);

            return res.status(400).json({
                success: false,
                message: messages.join(", ")
            });

        }

        // Invalid customer ID
        if (error.name === "CastError") {

            return res.status(400).json({
                success: false,
                message: "Invalid customer ID"
            });

        }

        res.status(500).json({
            success: false,
            message: "Server error"
        });

    }

});
// =====================================================
// GET ALL TRANSACTIONS
// =====================================================

app.get("/transactions", async (req, res) => {

    try {

        const transactions = await Transaction
            .find()
            .populate("customerId", "name email phone")
            .sort({ transactionDate: -1 });

        res.json({
            success: true,
            count: transactions.length,
            transactions: transactions
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: "Could not fetch transactions"
        });

    }

});
// =====================================================
// GET CUSTOMER TRANSACTIONS
// =====================================================

app.get("/customers/:id/transactions", async (req, res) => {

    try {

        const customer = await Customer.findById(req.params.id);

        if (!customer) {

            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });

        }

        const transactions = await Transaction
            .find({ customerId: req.params.id })
            .sort({ transactionDate: -1 });

        res.json({
            success: true,
            customer: customer,
            count: transactions.length,
            transactions: transactions
        });

    } catch (error) {

        res.status(400).json({
            success: false,
            message: "Invalid customer ID"
        });

    }

});
// =====================================================
// CUSTOMER SEGMENTATION
// =====================================================

app.get("/analytics/segmentation", async (req, res) => {

    try {

        const customers = await Customer.find();

        const today = new Date();

        const segmentationData = [];

        for (const customer of customers) {

            const transactions = await Transaction.find({
                customerId: customer._id
            }).sort({ transactionDate: -1 });


            // ==========================================
            // NO TRANSACTIONS
            // ==========================================

            if (transactions.length === 0) {

                segmentationData.push({
                    customerId: customer._id,
                    name: customer.name,
                    email: customer.email,
                    totalTransactions: 0,
                    totalSpent: 0,
                    lastTransaction: null,
                    segment: "Inactive"
                });

                continue;
            }


            // ==========================================
            // TOTAL TRANSACTIONS
            // ==========================================

            const totalTransactions = transactions.length;


            // ==========================================
            // TOTAL SPENDING
            // ==========================================

            const totalSpent = transactions.reduce(
                (total, transaction) => {
                    return total + transaction.amount;
                },
                0
            );


            // ==========================================
            // LAST TRANSACTION
            // ==========================================

            const lastTransaction = new Date(
                transactions[0].transactionDate
            );


            // Calculate days since last transaction

            const differenceInTime =
                today.getTime() - lastTransaction.getTime();

            const daysSinceLastTransaction = Math.floor(
                differenceInTime /
                (1000 * 60 * 60 * 24)
            );


            // ==========================================
            // SEGMENTATION LOGIC
            // ==========================================

            let segment;


            // More than 60 days
            if (daysSinceLastTransaction > 60) {

                segment = "At Risk";

            }

            // 3+ transactions AND ₹10,000+
            else if (
                totalTransactions >= 3 &&
                totalSpent >= 10000
            ) {

                segment = "High Value";

            }

            // 2+ transactions OR ₹5,000+
            else if (
                totalTransactions >= 2 ||
                totalSpent >= 5000
            ) {

                segment = "Regular";

            }

            // One transaction
            else {

                segment = "Occasional";

            }


            // ==========================================
            // ADD RESULT
            // ==========================================

            segmentationData.push({

                customerId: customer._id,

                name: customer.name,

                email: customer.email,

                totalTransactions: totalTransactions,

                totalSpent: totalSpent,

                lastTransaction: lastTransaction,

                daysSinceLastTransaction:
                    daysSinceLastTransaction,

                segment: segment

            });

        }


        // ==========================================
        // RESPONSE
        // ==========================================

        res.json({

            success: true,

            count: segmentationData.length,

            customers: segmentationData

        });

    } catch (error) {

        console.error(
            "Segmentation Error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Could not perform customer segmentation"

        });

    }

});
// =====================================================
// CUSTOMER ANALYTICS
// =====================================================

app.get("/analytics/summary", async (req, res) => {

    try {

        // Get all customers
        const customers = await Customer.find();

        // Get all transactions
        const transactions = await Transaction.find();

        // -----------------------------------------------
        // BASIC STATISTICS
        // -----------------------------------------------

        const totalCustomers = customers.length;

        const totalTransactions = transactions.length;

        const totalRevenue = transactions.reduce(
            (total, transaction) => {
                return total + transaction.amount;
            },
            0
        );

        const averageTransactionValue =
            totalTransactions > 0
                ? totalRevenue / totalTransactions
                : 0;


        // -----------------------------------------------
        // GET SEGMENTATION
        // -----------------------------------------------

        const today = new Date();

        const segmentCounts = {
            "High Value": 0,
            "Regular": 0,
            "Occasional": 0,
            "At Risk": 0,
            "Inactive": 0
        };


        // -----------------------------------------------
        // CALCULATE SEGMENTS
        // -----------------------------------------------

        for (const customer of customers) {

            const customerTransactions =
                transactions.filter(
                    transaction =>
                        transaction.customerId.toString() ===
                        customer._id.toString()
                );


            // No transactions
            if (customerTransactions.length === 0) {

                segmentCounts["Inactive"]++;

                continue;
            }


            const totalSpent =
                customerTransactions.reduce(
                    (total, transaction) => {
                        return total + transaction.amount;
                    },
                    0
                );


            const sortedTransactions =
                customerTransactions.sort(
                    (a, b) =>
                        new Date(b.transactionDate) -
                        new Date(a.transactionDate)
                );


            const lastTransaction =
                new Date(
                    sortedTransactions[0].transactionDate
                );


            const differenceInTime =
                today.getTime() -
                lastTransaction.getTime();


            const daysSinceLastTransaction =
                Math.floor(
                    differenceInTime /
                    (1000 * 60 * 60 * 24)
                );


            let segment;


            // At Risk
            if (daysSinceLastTransaction > 60) {

                segment = "At Risk";

            }

            // High Value
            else if (
                customerTransactions.length >= 3 &&
                totalSpent >= 10000
            ) {

                segment = "High Value";

            }

            // Regular
            else if (
                customerTransactions.length >= 2 ||
                totalSpent >= 5000
            ) {

                segment = "Regular";

            }

            // Occasional
            else {

                segment = "Occasional";

            }


            segmentCounts[segment]++;

        }


        // -----------------------------------------------
        // SEND RESPONSE
        // -----------------------------------------------

        res.json({

            success: true,

            analytics: {

                totalCustomers: totalCustomers,

                totalTransactions: totalTransactions,

                totalRevenue: totalRevenue,

                averageTransactionValue:
                    Number(
                        averageTransactionValue.toFixed(2)
                    ),

                segments: segmentCounts

            }

        });

    } catch (error) {

        console.error(
            "Analytics Error:",
            error
        );

        res.status(500).json({

            success: false,

            message: "Could not generate analytics"

        });

    }

});
// =====================================================
// START SERVER
// =====================================================

app.listen(3000, () => {
    console.log("Server Started");
});