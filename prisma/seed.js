const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  // Create or get a demo user (used to own all seeded data)
  const passwordHash = await bcrypt.hash('demo123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@yb.com' },
    update: { name: 'Demo User' },
    create: {
      email: 'demo@yb.com',
      passwordHash,
      name: 'Demo User',
    },
  });

  // Settings single row (unique by userId)
  await prisma.settings.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      companyName: 'YB Invoice Maker',
      logoUrl: '',
      bankName: 'Bank BCA',
      bankAccount: '1234567890',
      invoicePrefix: 'INV',
      defaultTaxRate: 11,
      currency: 'IDR',
      language: 'id-ID',
      themeKey: 'pastel1',
      npwp: '',
      address: 'Jakarta, Indonesia',
    },
  });

  // Seed Customers
  const customers = [
    {
      id: 'cust-pt-teknologi-maju',
      name: 'PT Teknologi Maju',
      companyName: 'PT Teknologi Maju',
      email: 'info@tekmaju.com',
      phone: '021-1234567',
      address: 'Jl. Sudirman No. 123, Jakarta',
      taxId: '',
    },
    {
      id: 'cust-cv-nusantara-abadi',
      name: 'CV Nusantara Abadi',
      companyName: 'CV Nusantara Abadi',
      email: 'admin@cvna.co.id',
      phone: '021-7654321',
      address: 'Jl. Thamrin No. 45, Bandung',
      taxId: '',
    },
  ];

  for (const c of customers) {
    await prisma.customer.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        companyName: c.companyName ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
        address: c.address ?? null,
        taxId: c.taxId ?? null,
      },
      create: { ...c, userId: user.id },
    });
  }

  // Seed Products
  const products = [
    {
      id: 'prod-website-dev',
      name: 'Website Development',
      description: 'Pembuatan website company profile',
      price: 15000000,
      unit: 'paket',
      taxRate: 11,
      active: true,
    },
    {
      id: 'prod-mobile-app',
      name: 'Mobile App Development',
      description: 'Pembuatan aplikasi mobile iOS & Android',
      price: 25000000,
      unit: 'paket',
      taxRate: 11,
      active: true,
    },
    {
      id: 'prod-uiux',
      name: 'UI/UX Design',
      description: 'Desain antarmuka dan pengalaman pengguna',
      price: 5000000,
      unit: 'paket',
      taxRate: 11,
      active: true,
    },
    {
      id: 'prod-consulting',
      name: 'Konsultasi IT',
      description: 'Konsultasi teknologi informasi per jam',
      price: 500000,
      unit: 'jam',
      taxRate: 2,
      active: true,
    },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {
        name: p.name,
        description: p.description ?? null,
        price: p.price,
        unit: p.unit ?? null,
        taxRate: p.taxRate ?? null,
        active: p.active,
      },
      create: { ...p, userId: user.id },
    });
  }

  // Sample invoices
  const invoices = [
    {
      id: 'INV-2024-001',
      customerId: 'cust-pt-teknologi-maju',
      clientName: 'PT Teknologi Maju',
      date: '2024-10-01',
      dueDate: '2024-10-31',
      status: 'terkirim',
      note: 'Terima kasih',
      items: [
        { description: 'Jasa Pengembangan Web', unitPrice: 5000000, quantity: 3, taxRate: 11 },
      ],
    },
    {
      id: 'INV-2024-002',
      customerId: 'cust-cv-nusantara-abadi',
      clientName: 'CV Nusantara Abadi',
      date: '2024-09-15',
      dueDate: '2024-10-15',
      status: 'terkirim',
      note: '',
      items: [
        { description: 'Maintenance Sistem', unitPrice: 5650000, quantity: 1, taxRate: 11 },
      ],
    },
  ];

  for (const inv of invoices) {
    const total = inv.items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
    const created = await prisma.invoice.upsert({
      where: { id: inv.id },
      update: {
        clientName: inv.clientName,
        date: inv.date,
        dueDate: inv.dueDate,
        status: inv.status,
        note: inv.note,
        total,
        customerId: inv.customerId ?? null,
        userId: user.id,
      },
      create: {
        id: inv.id,
        clientName: inv.clientName,
        date: inv.date,
        dueDate: inv.dueDate,
        status: inv.status,
        note: inv.note,
        total,
        customerId: inv.customerId ?? null,
        userId: user.id,
      },
    });

    // Replace items
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: created.id } });
    for (const it of inv.items) {
      const amount = it.unitPrice * it.quantity;
      await prisma.invoiceItem.create({
        data: {
          invoiceId: created.id,
          description: it.description,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
          taxRate: it.taxRate ?? null,
          amount,
        },
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });