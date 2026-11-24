require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { getData, saveData, isJimmyChiang } = require('../server/database');

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const dining = [
    ['Chipotle Mexican Grill', 'Dining', 18.47],
    ['In-N-Out Burger', 'Dining', 14.22],
    ['Panera Bread', 'Dining', 16.85],
    ['Shake Shack', 'Dining', 19.4],
    ["Raising Cane's", 'Dining', 15.73],
    ['The Cheesecake Factory', 'Dining', 62.18],
    ['Olive Garden', 'Dining', 48.9],
    ['Panda Express', 'Dining', 13.64],
    ['Starbucks Coffee', 'Dining', 7.85],
    ['Peet\'s Coffee', 'Dining', 6.45],
    ['Dutch Bros Coffee', 'Dining', 8.1],
    ['DoorDash', 'Dining', 27.33],
    ['Uber Eats', 'Dining', 31.2],
    ['Sweetgreen', 'Dining', 17.96],
    ['Cava', 'Dining', 16.4],
    ['Five Guys', 'Dining', 18.05],
    ['Taco Bell', 'Dining', 11.28],
    ['McDonald\'s', 'Dining', 9.74],
    ['IHOP', 'Dining', 22.15],
    ['Red Robin', 'Dining', 36.8]
];

const groceries = [
    ['Trader Joe\'s', 'Groceries', 54.12],
    ['Whole Foods Market', 'Groceries', 86.4],
    ['Sprouts Farmers Market', 'Groceries', 47.66],
    ['Safeway', 'Groceries', 63.29],
    ['Ralphs', 'Groceries', 71.08],
    ['Costco Wholesale', 'Shopping', 142.55],
    ['Aldi', 'Groceries', 38.91],
    ['H-E-B', 'Groceries', 59.33]
];

const gas = [
    ['Shell Oil', 'Gas & Fuel', 48.62],
    ['Chevron', 'Gas & Fuel', 52.17],
    ['Costco Gas', 'Gas & Fuel', 41.08],
    ['76 Gas Station', 'Gas & Fuel', 46.9],
    ['ARCO', 'Gas & Fuel', 39.44],
    ['ExxonMobil', 'Gas & Fuel', 51.26],
    ['Valero', 'Gas & Fuel', 44.71],
    ['Circle K Fuel', 'Gas & Fuel', 37.85]
];

const other = [
    ['Spotify USA', 'Subscriptions', 16.99],
    ['Netflix.com', 'Subscriptions', 15.49],
    ['Apple.com/Bill', 'Subscriptions', 2.99],
    ['Amazon.com', 'Online Purchase', 34.18],
    ['Amazon Prime', 'Subscriptions', 14.99],
    ['Target', 'Shopping', 52.67],
    ['CVS Pharmacy', 'Health & Wellness', 18.44],
    ['Walgreens', 'Health & Wellness', 12.7],
    ['Uber Trip', 'Travel', 18.35],
    ['Lyft', 'Travel', 14.8],
    ['PG&E', 'Utilities', 94.22],
    ['AT&T Wireless', 'Phone Bill', 86.5],
    ['Verizon Wireless', 'Phone Bill', 79.99],
    ['LA Department of Water', 'Utilities', 41.6],
    ['Parking Garage', 'Travel', 12],
    ['AMC Theatres', 'Entertainment', 28.5],
    ['Steam Games', 'Entertainment', 19.99],
    ['Best Buy', 'Electronics', 89.0],
    ['Home Depot', 'Home & Garden', 64.33],
    ['IKEA', 'Home & Garden', 77.2],
    ['Nike Store', 'Shopping', 95.0],
    ['Gap', 'Shopping', 42.18],
    ['Petco', 'Pets', 36.47],
    ['Chewy.com', 'Pets', 49.12],
    ['Planet Fitness', 'Health & Wellness', 24.99],
    ['Delta Air Lines', 'Travel', 214.6],
    ['Southwest Airlines', 'Travel', 168.4],
    ['Airbnb', 'Travel', 189.0],
    ['USPS', 'Services', 9.65],
    ['FedEx Office', 'Services', 16.4],
    ['YouTube Premium', 'Subscriptions', 13.99],
    ['iCloud Storage', 'Subscriptions', 2.99],
    ['Adobe Acrobat', 'Subscriptions', 19.99],
    ['Google One', 'Subscriptions', 9.99],
    ['Hulu', 'Subscriptions', 17.99]
];

function pick(list, n) {
    return list[Math.abs(Math.floor(n)) % list.length];
}

function money(base, salt) {
    const cents = ((Math.abs(salt) * 17) % 87) / 100;
    return Math.round((base + cents) * 100) / 100;
}

function entry(date, row, salt) {
    return {
        month: MONTHS[date.getMonth()],
        day: date.getDate(),
        year: date.getFullYear(),
        desc: row[0],
        sub: row[1],
        amount: money(row[2], salt + date.getDate() + date.getMonth()),
        type: 'negative'
    };
}

function generateJimmyTransactions() {
    const coffee = dining.filter(function (row) {
        return /coffee|starbucks|peet|dutch/i.test(row[0]);
    });
    const lunch = dining.filter(function (row) {
        return !/coffee|starbucks|peet|dutch/i.test(row[0]);
    });
    const txs = [];
    const start = new Date(2024, 0, 2);
    const end = new Date(2026, 10, 22);
    let cursor = new Date(start);
    let salt = 1;
    let lastGas = 0;
    let lastGrocery = 0;
    let lastPharmacy = 0;
    let lastAmazon = 0;

    while (cursor <= end) {
        const year = cursor.getFullYear();
        const month = cursor.getMonth();
        const day = cursor.getDate();
        const weekday = cursor.getDay();
        const dayNum = Math.floor(cursor.getTime() / 86400000);

        if (day === 5) {
            txs.push(entry(cursor, ['Spotify USA', 'Subscriptions', 16.99], salt++));
        }
        if (day === 12) {
            txs.push(entry(cursor, pick([['AT&T Wireless', 'Phone Bill', 86.5], ['Verizon Wireless', 'Phone Bill', 79.99]], month + year), salt++));
        }
        if (day === 18 && month % 2 === 0) {
            txs.push(entry(cursor, pick([['PG&E', 'Utilities', 94.22], ['LA Department of Water', 'Utilities', 41.6]], month), salt++));
        }
        if (day === 1 || day === 15) {
            txs.push({
                month: MONTHS[month],
                day: day,
                year: year,
                desc: 'ACH Deposit - PAYROLL',
                sub: 'Direct Deposit',
                amount: 2187.44 + ((year - 2024) * 35) + (month * 4),
                type: 'positive'
            });
        }

        if (weekday >= 1 && weekday <= 5) {
            if (weekday === 1 || weekday === 3 || weekday === 5) {
                txs.push(entry(cursor, pick(coffee, dayNum + 3), salt++));
            }
            if (weekday === 2 || weekday === 4) {
                txs.push(entry(cursor, pick(lunch, dayNum + month), salt++));
            }
            if (weekday === 3 && month % 4 === 2) {
                txs.push(entry(cursor, ['Parking Garage', 'Travel', 12], salt++));
            }
        } else {
            if (weekday === 6 && dayNum - lastGrocery > 6) {
                txs.push(entry(cursor, pick(groceries, dayNum), salt++));
                lastGrocery = dayNum;
            }
            if (weekday === 0 && dayNum % 5 === 0) {
                txs.push(entry(cursor, pick(lunch, dayNum + 9), salt++));
            }
        }

        if (dayNum - lastGas >= 10) {
            txs.push(entry(cursor, pick(gas, dayNum), salt++));
            lastGas = dayNum;
        }
        if (dayNum - lastPharmacy >= 21 && weekday === 2) {
            txs.push(entry(cursor, pick([['CVS Pharmacy', 'Health & Wellness', 18.44], ['Walgreens', 'Health & Wellness', 12.7]], dayNum), salt++));
            lastPharmacy = dayNum;
        }
        if (dayNum - lastAmazon >= 12 && weekday === 4) {
            txs.push(entry(cursor, ['Amazon.com', 'Online Purchase', 27.4], salt++));
            lastAmazon = dayNum;
        }
        if (weekday === 5 && month % 3 === 1 && day > 14 && day < 22) {
            txs.push(entry(cursor, pick([['AMC Theatres', 'Entertainment', 28.5], ['Target', 'Shopping', 52.67], ['Petco', 'Pets', 36.47]], day + month), salt++));
        }

        cursor.setDate(cursor.getDate() + 1);
    }

    const seen = new Set();
    const unique = [];
    txs.forEach(function (tx) {
        const key = [tx.year, tx.month, tx.day, tx.desc].join('|');
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        unique.push(tx);
    });

    unique.sort(function (a, b) {
        const am = MONTHS.indexOf(a.month);
        const bm = MONTHS.indexOf(b.month);
        if (a.year !== b.year) return b.year - a.year;
        if (am !== bm) return bm - am;
        return b.day - a.day;
    });

    return unique;
}

async function run() {
    const data = await getData();
    const user = (data.users || []).find(function (item) {
        return isJimmyChiang(item.fullName);
    });

    if (!user) {
        throw new Error('Jimmy Chiang was not found. No accounts were changed.');
    }

    user.transactions = generateJimmyTransactions();
    user.successfulTransfers = 0;
    await saveData(data);

    const newest = user.transactions[0];
    const oldest = user.transactions[user.transactions.length - 1];
    console.log(JSON.stringify({
        updated: 'Jimmy Chiang',
        count: user.transactions.length,
        newest: newest.month + ' ' + newest.day + ' ' + newest.year,
        oldest: oldest.month + ' ' + oldest.day + ' ' + oldest.year,
        successfulTransfers: user.successfulTransfers
    }));
}

run().catch(function (error) {
    console.error(error.message);
    process.exit(1);
});
