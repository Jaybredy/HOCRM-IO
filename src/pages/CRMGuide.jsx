import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { BookOpen, ChevronRight } from 'lucide-react';

const sections = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    content: `## Welcome to GBSales-CRM CRM

The CRM is your central hub for managing hotel bookings, client relationships, and sales activity. Here's where to begin:

- **Dashboard (CRM tab):** Your home base — shows KPIs, pipeline, revenue trends, and today's snapshot.
- **Sidebar Navigation:** Use the **Hotels** dropdown for hotel-related actions and the main nav links for Clients, Tasks, and Reports.
- **Quick Actions:** Located at the bottom of the sidebar — use these for fast entry of common tasks like adding a booking, logging a call, or creating a task.
`
  },
  {
    id: 'crm-navigation',
    title: 'CRM Navigation',
    content: `## Navigating the CRM Dashboard

When you open the **Dashboard**, you'll see:

- **KPI Cards** — Total room nights, revenue, active pipeline, and conversion rate at a glance.
- **Pipeline Chart** — Visual breakdown of deals by stage (Solicitation → Definite).
- **Revenue Trend** — Month-by-month revenue tracking.
- **Today's Snapshot** — A summary of activity for today.
- **Upcoming Follow-Ups** — Deals or clients that need attention soon.

### The Hotels Dropdown
Click **Hotels** in the sidebar to access:
- **Add Booking** — Log a new group or event booking.
- **Add Catering Event** — Log a new catering inquiry or event.
- **Hotel GRC** — Full production calendar view.
- **My Performance** — Your personal sales metrics.
- **Hotel Performance** — Property-level analytics.
`
  },
  {
    id: 'client-management',
    title: 'Client Management',
    content: `## Managing Clients

Navigate to **Clients** in the sidebar.

### Viewing Clients
- Search and filter clients by status, activity type, or name.
- Each row shows the client's company, contact, status, and recent activity.

### Adding a Client
- Click **New Client** to open the creation form.
- Fill in company name, contact person, email, phone, and status.

### Client Profile
Click any client to open their full profile, which includes:
- **Contact Info** — Primary contact details.
- **Contacts List** — All associated contacts.
- **Deals** — Linked production items / bookings.
- **Activity Timeline** — A log of all interactions.
- **Notes** — Internal team notes.

### Client Statuses (Pipeline Stages)
\`New Lead → Reached Out → Solicitation Call → Sent Proposal → Follow Up → Prospect → Tentative → Definite → Active\`

Update the status as the relationship progresses to keep the pipeline accurate.
`
  },
  {
    id: 'task-management',
    title: 'Task Management',
    content: `## Managing Tasks

Navigate to **Tasks** in the sidebar (or use the **New Task** quick action).

### Creating a Task
- Click **Add Task** and fill in the title, due date, priority, and optionally assign it to a team member.
- Link tasks to a client or production item for better tracking.

### Task Priorities
| Priority | Use When |
|----------|----------|
| Urgent   | Needs immediate attention |
| High     | Due very soon or critical |
| Medium   | Standard follow-up |
| Low      | Nice to do, not time-sensitive |

### Task Statuses
- **To Do** → **In Progress** → **Completed**
- Cancelled tasks are removed from active views but kept in history.

### Tips
- Use the **calendar view** to see tasks by due date.
- Check the **Upcoming Follow-Ups** widget on the dashboard for quick task visibility.
`
  },
  {
    id: 'reporting',
    title: 'Reporting',
    content: `## Reporting & Exports

Navigate to **Reports** in the sidebar.

### Available Reports
- **Weekly Activity Report** — Summarizes all sales activity for the selected week by seller.
- **Production Report** — Full breakdown of bookings and revenue by property and period.
- **Seller Performance** — Individual seller metrics vs. targets.
- **Goals Report** — Progress toward team and individual goals.

### Exporting Data
- Select the report type, date range, and format (CSV, Excel, or PDF).
- Click **Export** — the file will download automatically.
- A record of all exports is saved in the **Export History** section.

### Hotel GRC (Group Rooms Calendar)
- Found under **Hotels → Hotel GRC**.
- Shows booked room nights on a calendar grid by property.
- Great for visualizing occupancy and pipeline at a glance.
`
  }
];

export default function CRMGuide() {
  const [activeSection, setActiveSection] = useState('getting-started');
  const current = sections.find(s => s.id === activeSection);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <BookOpen className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CRM User Guide</h1>
            <p className="text-sm text-gray-500">Learn how to navigate and use the GBSales-CRM CRM</p>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Sidebar Nav */}
          <aside className="w-52 flex-shrink-0">
            <nav className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {sections.map((section, i) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors border-b border-gray-100 last:border-0 ${
                    activeSection === section.id
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>{section.title}</span>
                  {activeSection === section.id && <ChevronRight className="w-4 h-4" />}
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <main className="flex-1 bg-white rounded-xl border border-gray-200 p-8">
            <div className="prose prose-blue max-w-none prose-headings:font-bold prose-h2:text-xl prose-h3:text-base prose-p:text-gray-700 prose-li:text-gray-700 prose-table:text-sm">
              <ReactMarkdown>{current?.content}</ReactMarkdown>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}