import { PrismaClient } from './generated/client/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const connectionString = "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url: connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
    const users = await prisma.user.findMany();
    console.log("USERS:", users);
}
main().catch(console.error);
