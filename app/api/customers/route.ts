import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';
import Package from '@/lib/models/Package';
import Billing from '@/lib/models/Billing';
import { getCurrentUser, requireAuthenticatedUser } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';

export async function GET(request: Request) {
  try {
    const authError = await requireAuthenticatedUser();
    if (authError) return authError;

    await connectDB();

    const { searchParams } = new URL(request.url);
    const archivedOnly = searchParams.get('archived') === 'true';
    const id = searchParams.get('id');
    const filter: Record<string, any> = id
      ? {}
      : archivedOnly
        ? { status: 'inactive' }
        : { status: { $ne: 'inactive' } };

    if (id) filter._id = id;

    // Ensure the referenced Package model is registered before populate() executes.
    await Package.findOne({}).lean();

    const customers = await Customer.find(filter).populate('packageId').sort({ name: 1 });
    return NextResponse.json(id ? customers[0] || null : customers);
  } catch (error) {
    console.error('GET /api/customers failed:', error);
    return NextResponse.json({ error: 'Gagal mengambil data pelanggan' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authError = await requireAuthenticatedUser();
    if (authError) return authError;

    await connectDB();
    const body = await request.json();
    const { name, address, packageId } = body;
    const currentUser = await getCurrentUser();
    const normalizedAddress = address?.trim() || '';

    if (!name) {
      return NextResponse.json({ error: 'Nama pelanggan wajib diisi' }, { status: 400 });
    }

    await Customer.syncIndexes();

    const existing = await Customer.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      address: normalizedAddress,
    });
    if (existing) {
      return NextResponse.json({ error: 'Nama pelanggan sudah ada' }, { status: 400 });
    }

    const customer = await Customer.create({
      name,
      address: normalizedAddress,
      packageId: packageId || null,
      createdBy: currentUser?.username || 'Admin',
      status: 'active',
      archivedAt: null,
    });
    await writeAuditLog({
      actorUsername: currentUser?.username || 'Admin',
      action: 'customer.created',
      entityType: 'customer',
      entityId: customer._id.toString(),
      entityLabel: customer.name,
      summary: `Pelanggan ${customer.name} ditambahkan`,
      changes: {
        before: null,
        after: {
          name: customer.name,
          address: customer.address,
          packageId: customer.packageId?.toString() || null,
          status: customer.status,
        },
      },
    });
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal menambah pelanggan' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authError = await requireAuthenticatedUser();
    if (authError) return authError;

    await connectDB();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const restore = searchParams.get('restore') === 'true';
    const permanent = searchParams.get('permanent') === 'true';

    if (!id) {
      return NextResponse.json({ error: 'ID pelanggan wajib diisi' }, { status: 400 });
    }

    const customer = await Customer.findById(id);
    if (!customer) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 });
    }

    if (restore) {
      const before = {
        status: customer.status,
        archivedAt: customer.archivedAt?.toISOString() || null,
      };
      customer.status = 'active';
      customer.archivedAt = null;
      await customer.save();
      const actor = await getCurrentUser();
      await writeAuditLog({
        actorUsername: actor?.username || 'Admin',
        action: 'customer.restored',
        entityType: 'customer',
        entityId: customer._id.toString(),
        entityLabel: customer.name,
        summary: `Pelanggan ${customer.name} dipulihkan dari arsip`,
        changes: { before, after: { status: customer.status, archivedAt: null } },
      });
      return NextResponse.json({ message: 'Pelanggan berhasil dipulihkan' });
    }

    if (permanent) {
      if (customer.status !== 'inactive') {
        return NextResponse.json({ error: 'Hanya pelanggan yang sudah diarsipkan yang dapat dihapus permanen' }, { status: 400 });
      }

      const before = {
        name: customer.name,
        address: customer.address,
        packageId: customer.packageId?.toString() || null,
        status: customer.status,
      };
      const deletedBillings = await Billing.deleteMany({ customerId: customer._id });
      await Customer.findByIdAndDelete(id);
      const actor = await getCurrentUser();
      await writeAuditLog({
        actorUsername: actor?.username || 'Admin',
        action: 'customer.deleted',
        entityType: 'customer',
        entityId: customer._id.toString(),
        entityLabel: customer.name,
        summary: `Data pelanggan ${customer.name} dan ${deletedBillings.deletedCount} riwayat tagihan dihapus permanen`,
        changes: { before, after: null },
      });
      return NextResponse.json({
        message: 'Pelanggan dan riwayat tagihannya berhasil dihapus permanen',
        deletedBillings: deletedBillings.deletedCount,
      });
    }

    const before = {
      status: customer.status,
      archivedAt: customer.archivedAt?.toISOString() || null,
    };
    customer.status = 'inactive';
    customer.archivedAt = new Date();
    await customer.save();
    const actor = await getCurrentUser();
    await writeAuditLog({
      actorUsername: actor?.username || 'Admin',
      action: 'customer.archived',
      entityType: 'customer',
      entityId: customer._id.toString(),
      entityLabel: customer.name,
      summary: `Pelanggan ${customer.name} diarsipkan`,
      changes: { before, after: { status: customer.status, archivedAt: customer.archivedAt?.toISOString() || null } },
    });

    return NextResponse.json({ message: 'Pelanggan berhasil diarsipkan dan tidak dihapus dari database' });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mengarsipkan pelanggan' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authError = await requireAuthenticatedUser();
    if (authError) return authError;

    await connectDB();
    const body = await request.json();
    const { id, address, packageId } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID pelanggan wajib diisi' }, { status: 400 });
    }

    const previousCustomer = await Customer.findById(id);
    if (!previousCustomer) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 });
    }
    const customer = await Customer.findByIdAndUpdate(
      id,
      { address: address || '', packageId: packageId || null },
      { new: true, runValidators: true }
    ).populate('packageId');

    if (!customer) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 });
    }

    const actor = await getCurrentUser();
    await writeAuditLog({
      actorUsername: actor?.username || 'Admin',
      action: 'customer.updated',
      entityType: 'customer',
      entityId: customer._id.toString(),
      entityLabel: customer.name,
      summary: `Alamat atau paket pelanggan ${customer.name} diperbarui`,
      changes: {
        before: {
          address: previousCustomer.address || '',
          packageId: previousCustomer.packageId?.toString() || null,
        },
        after: {
          address: customer.address || '',
          packageId: packageId || null,
        },
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    return NextResponse.json({ error: 'Gagal memperbarui data pelanggan' }, { status: 500 });
  }
}
