'use client';

import SignupForm from '@/components/auth/signup-form';
import LeftSection from '@/components/auth/left-section';

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex bg-white">
      {/* Left Section - Dark with 3D Scene */}
      <LeftSection />

      {/* Right Section - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 lg:px-12 py-12">
        <SignupForm />
      </div>
    </main>
  );
}
