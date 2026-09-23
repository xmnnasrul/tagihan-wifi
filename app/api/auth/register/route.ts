import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { signToken, COOKIE_NAME } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    const cleanUsername = typeof username === 'string' ? username.trim() : '';

    if (cleanUsername.length < 3 || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Username minimal 3 karakter dan password minimal 6 karakter' },
        { status: 400 }
      );
    }

    await connectDB();
    const existingUser = await User.findOne({ username: cleanUsername }).lean();
    if (existingUser) {
      return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username: cleanUsername,
      password: hashedPassword,
      role: 'user',
    });

    const response = NextResponse.json(
      { message: 'Pendaftaran berhasil', user: { username: user.username, role: user.role } },
      { status: 201 }
    );
    response.cookies.set(COOKIE_NAME, signToken({ username: user.username, role: user.role }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Gagal membuat akun' }, { status: 500 });
  }
}