import React from 'react';

interface PageHeaderProps {
    title: string;
    description: string;
    icon: string;
}

export default function PageHeader({ title, description, icon }: PageHeaderProps) {
    return (
        <div className="relative overflow-hidden rounded-2xl mb-6 p-5 sm:p-6" style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
            border: '1px solid var(--border-subtle)',
        }}>
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 pointer-events-none"
                style={{ background: 'radial-gradient(circle, var(--accent-primary), transparent 70%)', filter: 'blur(60px)' }} />
            
            <div className="relative z-10 flex flex-col md:flex-row gap-4 items-start md:items-center">
                <div className="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center text-2xl shadow-lg"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
                    {icon}
                </div>
                <div>
                    <h1 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                        {title}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest bg-white/5 text-white/50 border border-white/10">
                            Analytics
                        </span>
                    </h1>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/60 max-w-3xl">
                        {description}
                    </p>
                </div>
            </div>
        </div>
    );
}
