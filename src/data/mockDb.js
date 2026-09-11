export const mockPatients = [
  {
    id: 'pat_1',
    name: 'Sarah Jenkins',
    age: 42,
    email: 'sarah.j@example.com',
    gender: 'Female',
    bloodType: 'A+',
    nextCheckup: '2026-04-12T09:00:00Z',
    severity: 'stable',
    category: 'General',
    alerts: [
      { id: 1, type: 'warning', message: 'Mildly elevated blood pressure observed last month. Reduce sodium intake.' },
      { id: 2, type: 'info', message: 'Annual vision exam is due in 30 days.' }
    ],
    history: [
      { id: 'rep_1', date: '2026-03-15', title: 'Comprehensive Blood Panel', result: 'All nominal, Vitamin D slightly low.' },
      { id: 'rep_2', date: '2025-09-10', title: 'Cardiac Echo', result: 'Normal sinus rhythm. No abnormalities detected.' }
    ],
    trends: [
      { month: 'Oct', bpSystolic: 118, bpDiastolic: 78, glucose: 92 },
      { month: 'Nov', bpSystolic: 122, bpDiastolic: 80, glucose: 94 },
      { month: 'Dec', bpSystolic: 120, bpDiastolic: 79, glucose: 90 },
      { month: 'Jan', bpSystolic: 126, bpDiastolic: 82, glucose: 98 },
      { month: 'Feb', bpSystolic: 124, bpDiastolic: 81, glucose: 95 },
      { month: 'Mar', bpSystolic: 128, bpDiastolic: 84, glucose: 96 } // Slight upward trend in BP
    ]
  },
  {
    id: 'pat_2',
    name: 'Robert Chawla',
    age: 58,
    email: 'robert_c@example.com',
    gender: 'Male',
    bloodType: 'O-',
    nextCheckup: '2026-03-28T14:30:00Z',
    severity: 'critical',
    category: 'Cardiac',
    alerts: [
      { id: 1, type: 'critical', message: 'URGENT: Abnormal ECG patterns detected during smart-watch monitor sync. Immediate physician review needed.' },
      { id: 2, type: 'warning', message: 'Cholesterol levels (LDL) are trending upward over 6 months.' }
    ],
    history: [
      { id: 'rep_3', date: '2026-03-24', title: 'AI Wearable ECG Analysis', result: 'Atrial fibrillations flagged during deep sleep.' },
      { id: 'rep_4', date: '2026-02-12', title: 'Lipid Profile', result: 'LDL at 160 mg/dL, HDL at 40 mg/dL.' }
    ],
    trends: [
      { month: 'Oct', bpSystolic: 135, bpDiastolic: 85, glucose: 105 },
      { month: 'Nov', bpSystolic: 140, bpDiastolic: 88, glucose: 110 },
      { month: 'Dec', bpSystolic: 142, bpDiastolic: 89, glucose: 108 },
      { month: 'Jan', bpSystolic: 148, bpDiastolic: 92, glucose: 115 },
      { month: 'Feb', bpSystolic: 152, bpDiastolic: 94, glucose: 118 },
      { month: 'Mar', bpSystolic: 158, bpDiastolic: 98, glucose: 122 } // Significant health deterioration
    ]
  },
  {
    id: 'pat_3',
    name: 'Aisha Patel',
    age: 28,
    email: 'apatel98@example.com',
    gender: 'Female',
    bloodType: 'B+',
    nextCheckup: '2026-06-01T10:00:00Z',
    severity: 'stable',
    category: 'Neurological',
    alerts: [
      { id: 1, type: 'info', message: 'Migraine frequency has decreased by 40% since starting new medication.' }
    ],
    history: [
      { id: 'rep_5', date: '2026-01-20', title: 'MRI Brain', result: 'Clear. No signs of structural abnormalities.' }
    ],
    trends: [
      { month: 'Oct', bpSystolic: 112, bpDiastolic: 72, glucose: 88 },
      { month: 'Nov', bpSystolic: 115, bpDiastolic: 75, glucose: 89 },
      { month: 'Dec', bpSystolic: 114, bpDiastolic: 74, glucose: 85 },
      { month: 'Jan', bpSystolic: 110, bpDiastolic: 70, glucose: 87 },
      { month: 'Feb', bpSystolic: 112, bpDiastolic: 72, glucose: 86 },
      { month: 'Mar', bpSystolic: 111, bpDiastolic: 71, glucose: 88 }
    ]
  }
];

export const getHospitalMetrics = () => {
  const total = mockPatients.length;
  const critical = mockPatients.filter(p => p.severity === 'critical').length;
  const categories = mockPatients.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {});

  return { total, critical, categories };
};

export const getPatientById = (id) => {
  return mockPatients.find(p => p.id === id);
};

export const getSortedHospitalPatients = () => {
  // Sort critical first, then alphabetical
  return [...mockPatients].sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (a.severity !== 'critical' && b.severity === 'critical') return 1;
    return a.name.localeCompare(b.name);
  });
};
