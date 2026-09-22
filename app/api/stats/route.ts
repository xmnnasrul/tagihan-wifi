import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';
import Billing from '@/lib/models/Billing';

export async function GET() {
  try {
    await connectDB();

    const totalCustomers = await Customer.countDocuments();

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().toLocaleString('id-ID', { month: 'long' });

    const currentBillings = await Billing.find({ year: currentYear, month: currentMonth });
    const totalBillings = currentBillings.length;
    const paidBillings = currentBillings.filter((b) => b.status === 'TF' || b.status === 'Cash').length;
    const installmentBillings = currentBillings.filter((b) => b.status === 'Nyicil').length;

    const totalRevenue = currentBillings.reduce((sum, b) => {
      if (b.status === 'TF' || b.status === 'Cash') return sum + b.packagePrice;
      if (b.status === 'Nyicil') return sum + b.installmentAmount;
      return sum;
    }, 0);

    const allBillings = await Billing.find({});
    const totalAllRevenue = allBillings.reduce((sum, b) => {
      if (b.status === 'TF' || b.status === 'Cash') return sum + b.packagePrice;
      if (b.status === 'Nyicil') return sum + b.installmentAmount;
      return sum;
    }, 0);

    return NextResponse.json({
      totalCustomers,
      totalBillings,
      paidBillings,
      installmentBillings,
      totalRevenue,
      totalAllRevenue,
      currentMonth,
      currentYear,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mengambil statistik' }, { status: 500 });
  }
}
