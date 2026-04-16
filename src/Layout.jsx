import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import GlobalSearch from '@/components/GlobalSearch';
import { LayoutDashboard, Building2, CheckCircle2, BarChart3, Award, TrendingUp, Plus, ListTodo, FileText, Upload, Settings, CalendarDays, Users, MessageSquare, ChevronDown, Briefcase, Phone, UtensilsCrossed, Home, FileSpreadsheet, Shield, BookOpen, Activity, Menu, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = ['admin', 'EPIC_ADMIN'].includes(user?.role);
  const [hotelsOpen, setHotelsOpen] = useState(false);
  const [rentalsOpen, setRentalsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const hotelPages = ['ProductionCalendar', 'MyPerformance', 'HotelPerformance'];
  const rentalPages = ['Units', 'PropertyAnalytics', 'LeaseRenewals', 'RentalsReports'];
  const isHotelActive = hotelPages.includes(currentPageName);
  const isRentalActive = rentalPages.includes(currentPageName);

  const hotelsActions = [
          { label: 'Add Booking', icon: Plus, page: 'CRM', params: '#add-production' },
          { label: 'Add Catering Event', icon: UtensilsCrossed, page: 'CRM', params: '#add-catering' },
          { label: 'Hotel GRC', icon: LayoutDashboard, page: 'ProductionCalendar', params: '' },
          { label: 'My Performance', icon: Award, page: 'MyPerformance', params: '' },
          { label: 'Hotel Performance', icon: TrendingUp, page: 'HotelPerformance', params: '' },
        ];

  // Hotel Sales Navigation
  const rentalsActions = [
  { label: 'New Tenant', icon: Plus, url: createPageUrl('Units') + '#add-unit' },
  { label: 'Units', icon: Building2, url: createPageUrl('Units') },
  { label: 'Property Analytics', icon: BarChart3, url: createPageUrl('PropertyAnalytics') },
  { label: 'Lease Renewals', icon: FileText, url: createPageUrl('LeaseRenewals') },
  { label: 'Reports', icon: FileSpreadsheet, url: createPageUrl('RentalsReports') },
];

const navItems = [
  { name: 'Clients', icon: Building2, page: 'Clients', params: '' },
  { name: 'All Bookings', icon: CalendarDays, page: 'Bookings', params: '' },
  { name: 'Sales Activities', icon: Activity, page: 'SalesActivities', params: '' },
  { name: 'Tasks', icon: CheckCircle2, page: 'Tasks', params: '' },
  { name: 'Reports', icon: FileText, page: 'Reports', params: '' },
  { name: 'RFP Tracker', icon: FileText, page: 'RFPs', params: '' }
];

  const quickActions = [
    { name: 'New Task', icon: ListTodo, page: 'Tasks', hash: '#add-task' },
    { name: 'Add Booking', icon: Plus, page: 'CRM', hash: '#add-production' },
    { name: 'Add Call', icon: Phone, page: 'CRM', hash: '#add-activity' },
    { name: 'Add Catering Event', icon: UtensilsCrossed, page: 'CRM', hash: '#add-catering' },
    { name: 'New RFP', icon: FileText, page: 'RFPs', hash: '#new-rfp' }
  ];

  const helpItems = [
    { name: 'CRM Guide', icon: BookOpen, page: 'CRMGuide' },
  ];

  const adminActions = isAdmin ? [
          { name: 'Users', icon: Users, page: 'UserManagement' },
          { name: 'Access Control', icon: Shield, page: 'AccessManagement' },
          { name: 'Settings', icon: Settings, page: 'Settings' },
        ] : [];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 h-12 bg-slate-900 border-b border-slate-800 z-30 flex items-center px-4 gap-3 lg:hidden">
        <button onClick={() => setSidebarOpen(v => !v)} className="text-slate-300 hover:text-white">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-bold text-white">GBSales-CRM</span>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`w-52 bg-slate-900 border-r border-slate-800 fixed h-full z-50 flex flex-col transition-transform duration-200
        ${ sidebarOpen ? 'translate-x-0' : '-translate-x-full' } lg:translate-x-0`}>
        {/* Logo */}
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-blue-400" />
            <span className="text-base font-bold text-white">GBSales-CRM</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white lg:hidden">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="bg-slate-800 p-2 flex-1 overflow-y-auto">
          <GlobalSearch />

          {/* Dashboard Link */}
          <Link
            to={createPageUrl('CRM')}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2 px-2.5 py-2 mb-1.5 rounded-md text-sm font-semibold transition-colors ${
              currentPageName === 'CRM' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}>
            <BarChart3 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Dashboard</span>
          </Link>

          {/* Hotels Dropdown Button */}
          <DropdownMenu open={hotelsOpen} onOpenChange={setHotelsOpen}>
            <DropdownMenuTrigger asChild>
              <button className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 mb-1.5 rounded-md text-sm font-semibold transition-colors ${isHotelActive ? 'bg-blue-600 text-white' : 'bg-slate-700/60 text-slate-200 hover:bg-slate-700 hover:text-white'}`}>
                <div className="flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Hotels</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${hotelsOpen ? 'rotate-180' : ''}`} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              align="start"
              className="bg-slate-800 border-slate-700 w-52"
            >
              {hotelsActions.map((action) => (
                <DropdownMenuItem
                  key={action.label}
                  onClick={() => { navigate(createPageUrl(action.page) + (action.params || '')); setHotelsOpen(false); setSidebarOpen(false); }}
                  className="text-slate-200 hover:bg-slate-700 hover:text-white cursor-pointer gap-2"
                >
                  <action.icon className="w-4 h-4 text-blue-400" />
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Rentals Dropdown Button */}
          <DropdownMenu open={rentalsOpen} onOpenChange={setRentalsOpen}>
            <DropdownMenuTrigger asChild>
              <button className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 mb-3 rounded-md text-sm font-semibold transition-colors ${isRentalActive ? 'bg-emerald-600 text-white' : 'bg-slate-700/60 text-slate-200 hover:bg-slate-700 hover:text-white'}`}>
                <div className="flex items-center gap-2">
                  <Home className="w-3.5 h-3.5" />
                  <span>Rentals</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${rentalsOpen ? 'rotate-180' : ''}`} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              align="start"
              className="bg-slate-800 border-slate-700 w-52"
            >
              {rentalsActions.map((action) => (
                <DropdownMenuItem
                  key={action.label}
                  onClick={() => { navigate(action.url); setRentalsOpen(false); setSidebarOpen(false); }}
                  className="text-slate-200 hover:bg-slate-700 hover:text-white cursor-pointer gap-2"
                >
                  <action.icon className="w-4 h-4 text-emerald-400" />
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="space-y-0.5">
            {navItems.map((item) =>
            <Link
              key={item.page + item.name}
              to={createPageUrl(item.page) + (item.params || '')}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-sm ${
                currentPageName === item.page
                  ? 'bg-slate-600 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}>
                <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </Link>
            )}
          </div>

          {/* Quick Actions */}
          <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-slate-100 mb-2 px-2.5 text-xs font-bold uppercase">QUICK ACTIONS</p>
            <div className="space-y-0.5">
              {quickActions.map((action) => <Link
                  key={action.name}
                  to={createPageUrl(action.page) + (action.hash || '')}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-md text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-sm">
                  <action.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{action.name}</span>
                </Link>
              )}
            </div>
          </div>

          {/* Help & Training */}
          <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-slate-100 mb-2 px-2.5 text-xs font-bold uppercase">Help</p>
            <div className="space-y-0.5">
              {helpItems.map((item) => (
                <Link
                  key={item.name}
                  to={createPageUrl(item.page)}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-md transition-colors text-sm ${
                    currentPageName === item.page
                      ? 'bg-blue-500 text-white font-semibold'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}>
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.name}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Admin Settings */}
          {adminActions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="text-slate-100 mb-2 px-2.5 text-xs font-bold uppercase">ADMIN</p>
              <div className="space-y-0.5">
                {adminActions.map((action) => (
                  <Link
                    key={action.name}
                    to={createPageUrl(action.page)}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-md transition-colors text-sm ${
                      currentPageName === action.page
                        ? 'bg-blue-500 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}>
                    <action.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{action.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          </nav>
          </aside>

          {/* Main Content */}
          <div className="lg:ml-52 flex-1 pt-12 lg:pt-0 min-w-0">
          {children}
          </div>
    </div>);

}