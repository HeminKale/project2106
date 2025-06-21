'use client';

import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import SettingsManager from '../components/SettingsManager';
import Layout from '../components/Layout';
import LoginForm from '../components/LoginForm';
import ProfileManager from '../components/ProfileManager';

export default function SettingsPage() {
    const { user, loading } = useAuth();
    const [activeTab, setActiveTab] = useState('home'); // Default to home tab

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

    const tabs = [
        { id: 'home', label: 'Home' },
        { id: 'object_manager', label: 'Object Manager' }
    ];

    return (
        <Layout>
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="mb-8">
                        <div className="border-b border-gray-200">
                            <nav className="-mb-px flex space-x-8">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`
                                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                                            ${activeTab === tab.id
                                                ? 'border-blue-500 text-blue-600'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                            }
                                        `}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </div>

                    <div className="mt-6">
                        {activeTab === 'home' && <SettingsManager initialActiveMainTab="home" />}
                        {activeTab === 'object_manager' && <SettingsManager initialActiveMainTab="object_manager" />}
                    </div>
                </div>
            </div>
        </Layout>
    );
}