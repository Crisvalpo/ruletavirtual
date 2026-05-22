'use client';

import React from 'react';

export default function ScreenLayout({
    children
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {children}
        </>
    );
}
