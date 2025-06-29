'use client';

import React from 'react';
import { useAuth } from '../components/AuthProvider';
import SettingsManager from '../components/SettingsManager';
import Layout from '../components/Layout';
import LoginForm from '../components/LoginForm';

export default function SettingsPage() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!user) {
        return <LoginForm />;
    }

    return (
        <Layout>
            <SettingsManager />
        </Layout>
    );
}