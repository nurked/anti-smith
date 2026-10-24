/**
 * Fake CRM data. Every name, email, phone, ID and address is invented
 * (example.com addresses, 555-01xx phone numbers, national IDs starting 000).
 */
export const contacts = [
  { id: 1, name: 'Avery Example', company: 'Lumen Freight', email: 'avery@example.com', phone: '+1 555-0101', dob: '1984-03-12', nationalId: '000-12-3456', address: '1 Example Street, Springfield', owner: 'Dana', status: 'Customer', notes: 'Renewal due in March. Prefers phone calls in the morning.' },
  { id: 2, name: 'Jordan Sample', company: 'Brightwater Dental', email: 'jordan@example.com', phone: '+1 555-0102', dob: '1979-11-02', nationalId: '000-98-7654', address: '22 Sample Road, Riverton', owner: 'Lee', status: 'Lead', notes: 'Asked for a demo of the reporting module.' },
  { id: 3, name: 'Riley Placeholder', company: 'Northgate Bakery', email: 'riley@example.com', phone: '+1 555-0103', dob: '1991-07-27', nationalId: '000-45-6789', address: '3 Placeholder Lane, Fairview', owner: 'Dana', status: 'Customer', notes: 'Overdue invoice #4471; agreed to a payment plan.' },
  { id: 4, name: 'Morgan Testcase', company: 'Testcase Legal LLP', email: 'morgan@example.com', phone: '+1 555-0104', dob: '1966-01-30', nationalId: '000-11-2233', address: '44 Fixture Avenue, Lakeside', owner: 'Sam', status: 'Customer', notes: 'Medical leave until June; contact assistant instead.' },
  { id: 5, name: 'Casey Dummy', company: 'Dummy & Daughters', email: 'casey@example.com', phone: '+1 555-0105', dob: '1988-05-19', nationalId: '000-22-3344', address: '5 Mock Court, Hillcrest', owner: 'Lee', status: 'Churned', notes: 'Left for a competitor over pricing.' },
  { id: 6, name: 'Taylor Mockwell', company: 'Mockwell Clinics', email: 'taylor@example.com', phone: '+1 555-0106', dob: '1975-09-08', nationalId: '000-33-4455', address: '66 Stub Street, Oakdale', owner: 'Sam', status: 'Customer', notes: 'Handles patient records; strict data-processing agreement.' },
  { id: 7, name: 'Quinn Fakeington', company: 'Fakeington Energy', email: 'quinn@example.com', phone: '+1 555-0107', dob: '1993-12-01', nationalId: '000-44-5566', address: '7 Sandbox Way, Millbrook', owner: 'Dana', status: 'Lead', notes: 'Budget approval expected next quarter.' },
  { id: 8, name: 'Drew Notreal', company: 'Notreal Insurance', email: 'drew@example.com', phone: '+1 555-0108', dob: '1982-02-14', nationalId: '000-55-6677', address: '88 Specimen Blvd, Westbury', owner: 'Lee', status: 'Customer', notes: 'Escalated a billing dispute in January.' },
  { id: 9, name: 'Sam Specimen', company: 'Specimen Labs', email: 'sam@example.com', phone: '+1 555-0109', dob: '1990-06-23', nationalId: '000-66-7788', address: '9 Dummy Drive, Eastport', owner: 'Sam', status: 'Lead', notes: 'Wants SSO before signing.' },
  { id: 10, name: 'Robin Sandbox', company: 'Sandbox Schools', email: 'robin@example.com', phone: '+1 555-0110', dob: '1970-10-10', nationalId: '000-77-8899', address: '10 Example Street, Springfield', owner: 'Dana', status: 'Customer', notes: 'Pays by bank transfer; account ending 0042.' },
  { id: 11, name: 'Jamie Fixture', company: 'Fixture Hotels', email: 'jamie@example.com', phone: '+1 555-0111', dob: '1986-04-04', nationalId: '000-88-9900', address: '11 Placeholder Lane, Fairview', owner: 'Lee', status: 'Customer', notes: 'Requested data export for an audit.' },
  { id: 12, name: 'Alex Stubbs', company: 'Stubbs Logistics', email: 'alex@example.com', phone: '+1 555-0112', dob: '1979-08-18', nationalId: '000-99-0011', address: '12 Mock Court, Hillcrest', owner: 'Sam', status: 'Lead', notes: 'Met at the spring trade fair.' },
];

export const deals = [
  { id: 101, title: 'Fleet tracking rollout', contactId: 1, value: 48000, stage: 'Negotiation' },
  { id: 102, title: 'Reporting module', contactId: 2, value: 12000, stage: 'Qualified' },
  { id: 103, title: 'Three-store POS upgrade', contactId: 3, value: 21500, stage: 'Won' },
  { id: 104, title: 'Case management seats', contactId: 4, value: 36000, stage: 'Proposal' },
  { id: 105, title: 'Patient intake forms', contactId: 6, value: 54000, stage: 'Negotiation' },
  { id: 106, title: 'Pilot: energy dashboard', contactId: 7, value: 9000, stage: 'Qualified' },
  { id: 107, title: 'Claims workflow', contactId: 8, value: 72000, stage: 'Proposal' },
  { id: 108, title: 'Campus licence', contactId: 10, value: 30000, stage: 'Won' },
];

export const stages = ['Qualified', 'Proposal', 'Negotiation', 'Won'];

export const contactById = (id) => contacts.find((c) => c.id === Number(id)) ?? null;
