const sharedRestrictionBase = {
    title: 'Account Restricted',
    greeting: 'Dear {name},',
    message: 'Your account is temporarily restricted due to unresolved security issues.',
    feeText: 'A settlement fee of {fee} is required to restore full access and remove the restriction, so normal account operations will be restored.',
    button: 'I Understand',
    support: 'Contact Support'
};

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function createBlankUser() {
    const suffix = Date.now();
    return {
        id: 'user-' + suffix,
        fullName: 'New Customer',
        username: 'user' + suffix,
        password: '',
        loginPassword: '',
        accounts: [
            { name: 'Current Account', balance: 0 },
            { name: 'Savings Account', balance: 0 }
        ],
        transferError: deepClone(sharedTransferError),
        restriction: Object.assign({}, sharedRestrictionBase, { settlementFee: 25000 }),
        invest: deepClone(sharedInvest),
        transactions: deepClone(sharedTransactions),
        lastLoginAt: null,
        lastActiveAt: null
    };
}

function createLegacyMigrationUser(raw) {
    return {
        id: 'user-1',
        fullName: raw?.profile?.fullName || 'Customer',
        username: raw?.profile?.username || 'customer',
        password: raw?.profile?.password || '',
        accounts: raw?.accounts || [
            { name: 'Current Account', balance: 0 },
            { name: 'Savings Account', balance: 0 }
        ],
        transferError: raw?.transferError || {
            title: 'Error',
            message: "We're sorry, we weren't able to complete your request. Please try again.",
            button: 'Retry'
        },
        restriction: raw?.restriction || Object.assign({}, sharedRestrictionBase, { settlementFee: 25000 }),
        invest: raw?.invest || {
            totalValue: 0,
            changeAmount: 0,
            changePercent: 0,
            holdings: []
        },
        transactions: raw?.transactions || [],
        lastLoginAt: null,
        lastActiveAt: null
    };
}

const sharedTransactions = [
    { month: 'DEC', day: 14, year: 2025, desc: 'Dominion Energy', sub: 'Bill Pay', amount: 20000, type: 'negative' },
    { month: 'DEC', day: 13, year: 2025, desc: 'Delta Air Lines', sub: 'Travel', amount: 18450, type: 'negative' },
    { month: 'DEC', day: 12, year: 2025, desc: 'Dominion Energy', sub: 'Bill Pay', amount: 15000, type: 'negative' },
    { month: 'DEC', day: 11, year: 2025, desc: 'Marriott Hotels', sub: 'Lodging', amount: 12780, type: 'negative' },
    { month: 'DEC', day: 10, year: 2025, desc: 'ACH Deposit - EMPLOYER PAYROLL', sub: 'Direct Deposit', amount: 19500, type: 'positive' },
    { month: 'DEC', day: 9, year: 2025, desc: 'Dominion Energy', sub: 'Bill Pay', amount: 10000, type: 'negative' },
    { month: 'DEC', day: 8, year: 2025, desc: 'Hertz Rent A Car', sub: 'Travel', amount: 8920, type: 'negative' },
    { month: 'DEC', day: 7, year: 2025, desc: 'Whole Foods Market', sub: 'Groceries', amount: 6240, type: 'negative' },
    { month: 'DEC', day: 6, year: 2025, desc: 'Dominion Energy', sub: 'Bill Pay', amount: 5000, type: 'negative' },
    { month: 'DEC', day: 5, year: 2025, desc: 'UnitedHealthcare', sub: 'Medical Insurance', amount: 17850, type: 'negative' },
    { month: 'DEC', day: 4, year: 2025, desc: 'Hilton Hotels', sub: 'Travel', amount: 14320, type: 'negative' },
    { month: 'DEC', day: 3, year: 2025, desc: 'State Farm Insurance', sub: 'Auto Insurance', amount: 9650, type: 'negative' },
    { month: 'DEC', day: 2, year: 2025, desc: 'Costco Wholesale', sub: 'Shopping', amount: 7310, type: 'negative' },
    { month: 'DEC', day: 1, year: 2025, desc: 'IRS TAX REFUND', sub: 'Government Payment', amount: 16200, type: 'positive' },
    { month: 'NOV', day: 30, year: 2025, desc: 'Southwest Airlines', sub: 'Travel', amount: 11840, type: 'negative' },
    { month: 'NOV', day: 29, year: 2025, desc: "Lowe's Home Improvement", sub: 'Home & Garden', amount: 8540, type: 'negative' },
    { month: 'NOV', day: 28, year: 2025, desc: 'CVS Pharmacy', sub: 'Health & Wellness', amount: 5120, type: 'negative' },
    { month: 'NOV', day: 27, year: 2025, desc: 'Shell Oil', sub: 'Gas & Fuel', amount: 6890, type: 'negative' },
    { month: 'NOV', day: 26, year: 2025, desc: 'Verizon Wireless', sub: 'Phone Bill', amount: 5450, type: 'negative' },
    { month: 'NOV', day: 25, year: 2025, desc: 'Amazon.com', sub: 'Online Purchase', amount: 9230, type: 'negative' },
    { month: 'NOV', day: 24, year: 2025, desc: 'Mortgage Payment', sub: 'Home Loan', amount: 19800, type: 'negative' },
    { month: 'NOV', day: 23, year: 2025, desc: 'Fidelity 401K CONTRIBUTION', sub: 'Retirement', amount: 7500, type: 'negative' },
    { month: 'NOV', day: 22, year: 2025, desc: 'ACH Deposit - BONUS PAY', sub: 'Direct Deposit', amount: 12000, type: 'positive' },
    { month: 'NOV', day: 21, year: 2025, desc: "Trader Joe's", sub: 'Groceries', amount: 5780, type: 'negative' },
    { month: 'NOV', day: 20, year: 2025, desc: 'Geico Insurance', sub: 'Insurance', amount: 10450, type: 'negative' },
    { month: 'NOV', day: 19, year: 2025, desc: 'Wire Transfer - REAL ESTATE ESCROW', sub: 'External Transfer', amount: 187450, type: 'negative' },
    { month: 'NOV', day: 18, year: 2025, desc: 'ACH Deposit - CONSULTING FEE', sub: 'Direct Deposit', amount: 192800, type: 'positive' },
    { month: 'NOV', day: 17, year: 2025, desc: 'Wire Transfer - CONTRACTOR PAYMENT', sub: 'External Transfer', amount: 165320, type: 'negative' },
    { month: 'NOV', day: 16, year: 2025, desc: 'Investment Transfer - BROKERAGE', sub: 'Securities Transfer', amount: 178900, type: 'negative' },
    { month: 'NOV', day: 15, year: 2025, desc: 'ACH Deposit - RENT COLLECTION', sub: 'Direct Deposit', amount: 155600, type: 'positive' },
    { month: 'NOV', day: 14, year: 2025, desc: 'Wire Transfer - HOME RENOVATION', sub: 'External Transfer', amount: 199250, type: 'negative' },
    { month: 'NOV', day: 13, year: 2025, desc: 'ACH Deposit - ANNUAL BONUS', sub: 'Direct Deposit', amount: 200000, type: 'positive' },
    { month: 'NOV', day: 12, year: 2025, desc: 'Law Firm Retainer', sub: 'Legal Services', amount: 152400, type: 'negative' },
    { month: 'NOV', day: 11, year: 2025, desc: 'Wire Transfer - VEHICLE PURCHASE', sub: 'External Transfer', amount: 168750, type: 'negative' },
    { month: 'NOV', day: 10, year: 2025, desc: 'Tuition Payment - UNIVERSITY', sub: 'Education', amount: 175320, type: 'negative' },
    { month: 'NOV', day: 9, year: 2025, desc: 'Wire Transfer - MEDICAL CENTER', sub: 'Healthcare', amount: 189500, type: 'negative' },
    { month: 'NOV', day: 8, year: 2025, desc: 'ACH Deposit - INVESTMENT DIVIDEND', sub: 'Dividend', amount: 158920, type: 'positive' },
    { month: 'NOV', day: 7, year: 2025, desc: 'Wire Transfer - BUSINESS EXPENSE', sub: 'External Transfer', amount: 163480, type: 'negative' },
    { month: 'NOV', day: 6, year: 2025, desc: 'Capital Gains Distribution', sub: 'Investment Income', amount: 172650, type: 'positive' },
    { month: 'NOV', day: 5, year: 2025, desc: 'Wire Transfer - TAX PAYMENT', sub: 'Government Payment', amount: 198100, type: 'negative' },
    { month: 'NOV', day: 4, year: 2025, desc: 'ACH Deposit - ROYALTY PAYMENT', sub: 'Direct Deposit', amount: 161275, type: 'positive' },
    { month: 'NOV', day: 3, year: 2025, desc: 'Wire Transfer - PROPERTY INSURANCE', sub: 'Insurance', amount: 154890, type: 'negative' },
    { month: 'NOV', day: 2, year: 2025, desc: 'ACH Deposit - COMMISSION PAY', sub: 'Direct Deposit', amount: 196340, type: 'positive' },
    { month: 'NOV', day: 1, year: 2025, desc: 'Wire Transfer - LANDSCAPING PROJECT', sub: 'Home Improvement', amount: 167215, type: 'negative' },
    { month: 'OCT', day: 30, year: 2025, desc: 'ACH Deposit - SETTLEMENT PROCEEDS', sub: 'Direct Deposit', amount: 185720, type: 'positive' },
    { month: 'OCT', day: 29, year: 2025, desc: 'Wire Transfer - SOLAR INSTALLATION', sub: 'Home Improvement', amount: 179480, type: 'negative' },
    { month: 'OCT', day: 28, year: 2025, desc: 'ACH Deposit - TRUST DISTRIBUTION', sub: 'Direct Deposit', amount: 150000, type: 'positive' },
    { month: 'OCT', day: 27, year: 2025, desc: 'Wire Transfer - YACHT CHARTER', sub: 'Travel', amount: 193650, type: 'negative' }
];

const sharedInvest = {
    totalValue: 178542.18,
    changeAmount: 1932.8,
    changePercent: 1.1,
    holdings: [
        { name: 'NVIDIA Corp', symbol: 'NVDA', value: 48250, change: 1125.4 },
        { name: 'Tesla Inc', symbol: 'TSLA', value: 42180, change: 680.2 },
        { name: 'Apple Inc', symbol: 'AAPL', value: 35920, change: 412.5 },
        { name: 'Microsoft Corp', symbol: 'MSFT', value: 28500, change: 0 },
        { name: 'Bitcoin Trust', symbol: 'GBTC', value: 23692.18, change: -285.3 }
    ]
};

const sharedTransferError = {
    title: 'Error',
    message: "We're sorry, we weren't able to complete your request. Please try again.",
    button: 'Retry'
};

module.exports = {
    admin: {
        username: '',
        password: ''
    },
    users: [
        {
            id: 'megan-woods',
            fullName: 'Megan Woods',
            username: 'meganwoods',
            password: '',
            accounts: [
                { name: 'Current Account', balance: 562847.36 },
                { name: 'Savings Account', balance: 187152.64 }
            ],
            transferError: sharedTransferError,
            restriction: Object.assign({}, sharedRestrictionBase, { settlementFee: 25000 }),
            invest: sharedInvest,
            transactions: sharedTransactions,
            lastLoginAt: null,
            lastActiveAt: null
        },
        {
            id: 'alan-e-jackson',
            fullName: 'Alan E. Jackson',
            username: 'A_Eugene89',
            password: '',
            accounts: [
                { name: 'Current Account', balance: 743862.47 },
                { name: 'Savings Account', balance: 612518.39 },
                { name: 'Checking Account', balance: 443619.14 }
            ],
            transferError: sharedTransferError,
            restriction: Object.assign({}, sharedRestrictionBase, { settlementFee: 17000 }),
            invest: sharedInvest,
            transactions: sharedTransactions,
            lastLoginAt: null,
            lastActiveAt: null
        }
    ],
    createBlankUser: createBlankUser,
    createLegacyMigrationUser: createLegacyMigrationUser
};
