# Company Data Isolation Audit

## Critical Issues Found

### ✅ FIXED
1. **Dashboard.tsx** - Now filters by company_id with ViewAs support
2. **Employees.tsx** - Now filters by company_id with ViewAs support  
3. **EmployeeInterestIndicators.tsx** - Now filters by company_id with ViewAs support
4. **StrategicLearningDesignReport.tsx** - Now filters by company_id with ViewAs support

### ❌ NEEDS FIXING
1. **Resources.tsx** (Line 73-77) - Loads ALL resources without company filter
2. **GrowthAtAGlance.tsx** - Needs company filter check
3. **TeamDiagnosticSnapshot.tsx** - Needs company filter check
4. **TeamHealthRisks.tsx** - Needs company filter check
5. **OrganizationalGrowthDesign.tsx** - Needs company filter check
6. **CompanyStrategicLearningTab.tsx** - Needs company filter check

### ✅ CORRECT (Personal Data - filters by profile_id)
- MyGrowthPlan.tsx
- GrowthRoadmap.tsx
- GreatnessTracker.tsx
- AchievementsCard.tsx
- NinetyDayTracker.tsx
- PersonalVisionCard.tsx

### ✅ CORRECT (Manager Data - filters by manager's team)
- DiagnosticInsights.tsx
- TeamAnalytics.tsx
- ManagerDashboard.tsx

## Fix Strategy
1. Add ViewAs context import to all organizational components
2. Use viewAsCompanyId when available, fall back to user's company_id
3. Filter ALL database queries by company_id
4. Reload data when viewAsCompanyId changes
