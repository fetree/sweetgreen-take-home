import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const MENU_ITEMS = [
  {
    name: 'Harvest Bowl',
    description: 'Roasted chicken, sweet potato, apples, goat cheese, almonds, wild rice, balsamic vinaigrette',
    priceCents: 1495,
  },
  {
    name: 'Kale Caesar',
    description: 'Shaved parmesan, lemon, croutons, caesar dressing',
    priceCents: 1295,
  },
  {
    name: 'Guacamole Greens',
    description: 'Warm tortilla chips, fresh salsa, shaved cabbage, lime cilantro jalapeño vinaigrette',
    priceCents: 1245,
  },
  {
    name: 'Shroomami',
    description: 'Roasted tofu, edamame, shredded cabbage, cucumber, carrots, spicy sunflower seeds, miso sesame ginger dressing',
    priceCents: 1395,
  },
  {
    name: 'Super Green Goddess',
    description: 'Shaved parmesan, basil, cucumber, raw celery, raw broccoli, lemon, green goddess ranch',
    priceCents: 1295,
  },
  {
    name: 'Chicken + Brussels',
    description: 'Roasted chicken, shaved brussels, spicy broccoli, pickled onions, parmesan crisps, caesar dressing',
    priceCents: 1495,
  },
  {
    name: 'Fish Taco Bowl',
    description: 'Baja fish, tortilla strips, coleslaw, mango salsa, cilantro, lime tahini',
    priceCents: 1595,
  },
  {
    name: 'Protein Greens',
    description: 'Roasted chicken, warm quinoa, tomatoes, raw broccoli, raw celery, shaved parmesan, balsamic vinaigrette',
    priceCents: 1425,
  },
];

async function main() {
  const existing = await prisma.menuItem.count();
  if (existing > 0) {
    console.log(`Seed skipped — ${existing} menu items already present.`);
    return;
  }

  const { count } = await prisma.menuItem.createMany({ data: MENU_ITEMS });
  console.log(`Seeded ${count} menu items.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
