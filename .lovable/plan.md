

# Coach Mode — Cross-Company Team Building

## Overview
Add a `coach` role that allows users to build a team from ANY user across all companies. A user can hold both `coach` and `super_admin` roles simultaneously — the `coach` role alone does NOT grant view-as/impersonation abilities; those remain exclusive to `super_admin`.

## Database Changes (1 migration)

### 1. Add `coach` to `app_role` enum
```sql
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'coach';
```

### 2. RLS policy on `manager_assignments` for coaches
Coaches can manage their own assignments across any company:
```sql
CREATE POLICY "Coaches can manage own cross-company assignments"
ON public.manager_assignments
FOR ALL
USING (has_role(auth.uid(), 'coach') AND manager_id = auth.uid())
WITH CHECK (has_role(auth.uid(), 'coach') AND manager_id = auth.uid());
```

## Edge Function Changes

### `check-user-permissions/index.ts`
Add `'coach'` to the manager-equivalent role list in the `requireManager` check (alongside `manager`, `admin`, `super_admin`).

## Frontend Changes

### `ManageMyTeamDialog.tsx`
- Detect if user has `coach` role (add to existing role check)
- **If coach (and NOT in view-as mode):** query ALL active profiles across all companies (no `company_id` filter), join company name, group/show company badge per employee
- **If coach AND super_admin in view-as mode:** existing super_admin view-as behavior takes precedence (company-scoped)
- Remove `assigned_to_other` restriction for coaches (they can share employees with company managers)
- On save: use the **employee's own `company_id`** for the `manager_assignments` row

### `ManagerDashboard.tsx` — `loadDirectReports`
- Current logic: if `viewAsCompanyId` → filter by company; else → filter by `manager_id`
- Add coach path: if user is a coach and NOT in view-as mode, load all assignments where `manager_id = user.id` without company filter
- If coach+super_admin in view-as mode, the existing view-as logic applies (company-scoped)
- Add company name display in the direct reports list for coaches

### `ViewAsContext` — No changes
View-as remains super_admin only. Coaches without super_admin never see the view-as selector.

## Security Model Summary

| Capability | Coach only | Super Admin only | Coach + Super Admin |
|---|---|---|---|
| Build team across companies | Yes | Yes | Yes |
| View-as / impersonate company | No | Yes | Yes |
| Manage other managers' assignments | No | Yes | Yes |
| Access manager dashboard | Yes | Yes | Yes |

The `coach` role grants cross-company team building via `manager_assignments` RLS. View-as and impersonation remain gated by `super_admin` checks in `ViewAsContext` and `ManageMyTeamDialog`. A dual-role user gets both capabilities independently.

## Files to Change
1. **Migration SQL** — enum + RLS policy
2. **`check-user-permissions/index.ts`** — add `coach` to manager roles
3. **`ManageMyTeamDialog.tsx`** — cross-company loading for coaches
4. **`ManagerDashboard.tsx`** — cross-company direct reports for coaches

