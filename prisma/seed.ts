/**
 * Seed script — loads the Smash & Go menu (menu.pdf) into the database.
 *
 * Idempotent: wipes existing rows (in FK-safe order) and reinserts, so it's
 * safe to re-run after schema changes during development.
 *
 * Run with: npm run db:seed
 */

import { PrismaClient, SelectionType } from "@prisma/client";

const prisma = new PrismaClient();

async function reset() {
  // Delete in reverse dependency order.
  await prisma.orderLineItemModifier.deleteMany();
  await prisma.orderLineItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.comboComponent.deleteMany();
  await prisma.itemModifierGroup.deleteMany();
  await prisma.modifierOption.deleteMany();
  await prisma.modifierGroup.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
}

async function linkGroups(menuItemId: string, modifierGroupIds: string[]) {
  await prisma.itemModifierGroup.createMany({
    data: modifierGroupIds.map((modifierGroupId) => ({
      menuItemId,
      modifierGroupId,
    })),
  });
}

async function main() {
  await reset();

  // ── Categories ──────────────────────────────────────────────────────
  const [burgersCat, sidesCat, drinksCat, combosCat] = await Promise.all([
    prisma.category.create({ data: { name: "Burgers" } }),
    prisma.category.create({ data: { name: "Sides" } }),
    prisma.category.create({ data: { name: "Drinks" } }),
    prisma.category.create({ data: { name: "Combos" } }),
  ]);

  // ── Modifier groups (shared across the items that offer them) ──────
  const burgerAddOns = await prisma.modifierGroup.create({
    data: {
      name: "Burger Add-ons",
      selectionType: SelectionType.MULTIPLE,
      isRequired: false,
      options: {
        create: [
          { name: "Extra Cheese", priceDelta: 4 },
          { name: "Extra Patty", priceDelta: 10 },
          { name: "Fried Egg", priceDelta: 6 },
          { name: "Avocado", priceDelta: 5 },
        ],
      },
    },
  });

  const burgerRemovals = await prisma.modifierGroup.create({
    data: {
      name: "Burger Removals",
      selectionType: SelectionType.MULTIPLE,
      isRequired: false,
      options: {
        create: [
          { name: "No onions", priceDelta: 0 },
          { name: "No pickles", priceDelta: 0 },
        ],
      },
    },
  });

  const friesSize = await prisma.modifierGroup.create({
    data: {
      name: "Fries Size",
      selectionType: SelectionType.SINGLE,
      isRequired: true,
      options: {
        // basePrice on the menu item itself represents "Regular"
        create: [
          { name: "Regular", priceDelta: 0 },
          { name: "Large", priceDelta: 5 },
        ],
      },
    },
  });

  const softDrinkFlavor = await prisma.modifierGroup.create({
    data: {
      name: "Soft Drink Flavor",
      selectionType: SelectionType.SINGLE,
      isRequired: true,
      options: {
        create: [
          { name: "Coke", priceDelta: 0 },
          { name: "Sprite", priceDelta: 0 },
          { name: "Fanta", priceDelta: 0 },
        ],
      },
    },
  });

  const softDrinkSize = await prisma.modifierGroup.create({
    data: {
      name: "Soft Drink Size",
      selectionType: SelectionType.SINGLE,
      isRequired: true,
      options: {
        // basePrice on the menu item itself represents "Small"
        create: [
          { name: "Small", priceDelta: 0 },
          { name: "Medium", priceDelta: 2 },
          { name: "Large", priceDelta: 4 },
        ],
      },
    },
  });

  const icedTeaFlavor = await prisma.modifierGroup.create({
    data: {
      name: "Iced Tea Flavor",
      selectionType: SelectionType.SINGLE,
      isRequired: true,
      options: {
        create: [
          { name: "Peach", priceDelta: 0 },
          { name: "Lemon", priceDelta: 0 },
        ],
      },
    },
  });

  const milkshakeFlavor = await prisma.modifierGroup.create({
    data: {
      name: "Milkshake Flavor",
      selectionType: SelectionType.SINGLE,
      isRequired: true,
      options: {
        create: [
          { name: "Chocolate", priceDelta: 0 },
          { name: "Vanilla", priceDelta: 0 },
          { name: "Strawberry", priceDelta: 0 },
        ],
      },
    },
  });

  // ── Burgers ──────────────────────────────────────────────────────────
  const burgerDefs = [
    {
      name: "Grilled Chicken Burger",
      description: "grilled chicken breast, lettuce, tomato, onion",
      basePrice: 28,
    },
    {
      name: "Crispy Chicken Burger",
      description: "crispy fried chicken fillet, lettuce, mayo",
      basePrice: 26,
    },
    {
      name: "Veggie Burger",
      description: "spiced potato & pea patty, lettuce",
      basePrice: 24,
    },
    {
      name: "Double Chicken Smash",
      description: "two smashed chicken patties, cheese, onions",
      basePrice: 38,
    },
    {
      name: "Spicy Zinger Burger",
      description: "hot-marinated chicken, jalapeños, spicy mayo",
      basePrice: 30,
    },
  ];

  const burgers: Record<string, string> = {};
  for (const def of burgerDefs) {
    const item = await prisma.menuItem.create({
      data: { ...def, categoryId: burgersCat.id },
    });
    burgers[def.name] = item.id;
    await linkGroups(item.id, [burgerAddOns.id, burgerRemovals.id]);
  }

  // ── Sides ────────────────────────────────────────────────────────────
  const fries = await prisma.menuItem.create({
    data: {
      name: "Fries",
      description: "Regular 10 / Large 15",
      basePrice: 10,
      categoryId: sidesCat.id,
    },
  });
  await linkGroups(fries.id, [friesSize.id]);

  await prisma.menuItem.create({
    data: {
      name: "Loaded Cheese Fries",
      description: "cheddar sauce, jalapeños, spring onion",
      basePrice: 18,
      categoryId: sidesCat.id,
    },
  });

  // referenced below by the Zinger Combo's "side" slot
  const onionRings = await prisma.menuItem.create({
    data: {
      name: "Onion Rings",
      description: "6 pieces, crispy golden batter",
      basePrice: 14,
      categoryId: sidesCat.id,
    },
  });

  await prisma.menuItem.create({
    data: {
      name: "Mozzarella Sticks",
      description: "6 pieces, marinara dip",
      basePrice: 16,
      categoryId: sidesCat.id,
    },
  });

  await prisma.menuItem.create({
    data: {
      name: "Coleslaw",
      description: "creamy, fresh",
      basePrice: 8,
      categoryId: sidesCat.id,
    },
  });

  // ── Drinks ───────────────────────────────────────────────────────────
  const softDrink = await prisma.menuItem.create({
    data: {
      name: "Soft Drink",
      description: "Coke / Sprite / Fanta",
      basePrice: 6,
      categoryId: drinksCat.id,
    },
  });
  await linkGroups(softDrink.id, [softDrinkFlavor.id, softDrinkSize.id]);

  await prisma.menuItem.create({
    data: {
      name: "Fresh Lemon Mint",
      description: null,
      basePrice: 14,
      categoryId: drinksCat.id,
    },
  });

  const icedTea = await prisma.menuItem.create({
    data: {
      name: "Iced Tea",
      description: "peach or lemon",
      basePrice: 12,
      categoryId: drinksCat.id,
    },
  });
  await linkGroups(icedTea.id, [icedTeaFlavor.id]);

  const milkshake = await prisma.menuItem.create({
    data: {
      name: "Milkshake",
      description: "chocolate / vanilla / strawberry",
      basePrice: 18,
      categoryId: drinksCat.id,
    },
  });
  await linkGroups(milkshake.id, [milkshakeFlavor.id]);

  await prisma.menuItem.create({
    data: {
      name: "Bottled Water",
      description: "500ml",
      basePrice: 4,
      categoryId: drinksCat.id,
    },
  });

  // ── Combos ───────────────────────────────────────────────────────────
  // Combo = burger + side + medium soft drink, at a flat combo price
  // (already discounted vs. à la carte — see menu.pdf).
  const classicCombo = await prisma.menuItem.create({
    data: {
      name: "Classic Combo",
      description: "Grilled Chicken Burger + Regular Fries + Medium Soft Drink",
      basePrice: 42,
      isCombo: true,
      categoryId: combosCat.id,
    },
  });
  await prisma.comboComponent.createMany({
    data: [
      { comboId: classicCombo.id, slotName: "burger", defaultItemId: burgers["Grilled Chicken Burger"] },
      { comboId: classicCombo.id, slotName: "side", defaultItemId: fries.id },
      { comboId: classicCombo.id, slotName: "drink", defaultItemId: softDrink.id },
    ],
  });

  const zingerCombo = await prisma.menuItem.create({
    data: {
      name: "Zinger Combo",
      description: "Spicy Zinger Burger + Onion Rings + Medium Soft Drink",
      basePrice: 48,
      isCombo: true,
      categoryId: combosCat.id,
    },
  });
  await prisma.comboComponent.createMany({
    data: [
      { comboId: zingerCombo.id, slotName: "burger", defaultItemId: burgers["Spicy Zinger Burger"] },
      { comboId: zingerCombo.id, slotName: "side", defaultItemId: onionRings.id },
      { comboId: zingerCombo.id, slotName: "drink", defaultItemId: softDrink.id },
    ],
  });

  const itemCount = await prisma.menuItem.count();
  console.log(`Seeded ${itemCount} menu items across 4 categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
