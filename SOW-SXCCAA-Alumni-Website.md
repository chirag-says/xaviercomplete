# Statement of Work

## Alumni Directory & Connection Platform — sxccaa.org

| | |
|---|---|
| **Document** | Statement of Work (SOW) |
| **Project** | St. Xavier's College Alumni Association — Alumni Directory & Connection Platform |
| **Client** | St. Xavier's College Alumni Association (SXCCAA) |
| **Prepared by** | [Your name / Team name] |
| **Prepared for** | [Client / Sponsor name] |
| **Version** | 0.1 — Draft for review |
| **Date** | [DD Month YYYY] |
| **Status** | Awaiting client sign-off |

> **Note on the client name:** the existing site identifies the organisation as SXCCAA (West Zone chapter). Please confirm the exact legal entity name before this document is signed.

---

## 1. Background

SXCCAA currently operates `www.sxccaa.org` as a single-purpose promotional page — it advertises a past alumni event ("Xaverians Nostalgia '23"), lists donor pass tiers, and collects UPI payments. It carries a "Register with us" link but has no searchable alumni records, no member profiles, and no way for a current student to reach an alumnus.

The Association wants to replace this with a working platform: a searchable directory of alumni, and a safe, moderated way for current students and members to request a connection with them.

---

## 2. Objectives

1. Publish a searchable, filterable directory of SXCCAA alumni covering professional and academic information only.
2. Let current students and members request a connection with an alumnus **without ever exposing the alumnus's private contact details**.
3. Give the Association an admin panel to maintain alumni records year on year — adding new graduating batches and updating details as alumni change companies or roles.
4. Migrate the existing `sxccaa.org` domain to the new platform with no loss of existing content.

---

## 3. Scope of Work

### 3.1 Public Website

| Ref | Item | Description |
|---|---|---|
| P-01 | Home page | Association introduction, featured alumni, latest announcements, primary call-to-action into the directory |
| P-02 | About page | History of the Association, office bearers, committee |
| P-03 | Contact page | Enquiry form with spam protection; enquiries routed to a nominated Association mailbox |
| P-04 | Static content pages | Up to **5** additional CMS-free static pages (e.g. Constitution, Chapters, Gallery landing) |
| P-05 | Responsive layout | Full functionality on mobile, tablet and desktop |
| P-06 | Navigation, footer, legal | Global header/footer, Privacy Policy, Terms of Use (content supplied by Client, we implement) |

### 3.2 Alumni Directory

| Ref | Item | Description |
|---|---|---|
| D-01 | Directory listing | Paginated grid/list of alumni profiles |
| D-02 | Keyword search | Free-text search across name, company, designation, and location |
| D-03 | Filters | Graduation year (or range), degree/programme, department, industry, city/country, "open to connect" |
| D-04 | Sorting | By name and by graduation year |
| D-05 | Alumni profile page | Individual public page per alumnus showing only the fields listed in §4.1 |
| D-06 | Social links | Outbound links to LinkedIn and X (Twitter) where the alumnus has supplied them, opening in a new tab |
| D-07 | Privacy controls | Per-record flags — `visible_in_directory`, `open_to_connect` — honoured everywhere in the public site |
| D-08 | Empty/edge states | No-results state, missing-photo fallback, incomplete-profile handling |

### 3.3 Connection Request Feature

The core safety mechanism of this platform. **No alumnus email address or phone number is displayed on the public site at any point.**

| Ref | Item | Description |
|---|---|---|
| C-01 | Request form | Available on an alumnus profile only when `open_to_connect` is true. Captures requester's name, college roll/ID number, batch, email, purpose (dropdown: mentorship / career guidance / referral / research / other) and a message (character-limited) |
| C-02 | Requester email verification | One-time code (OTP) sent to the requester's email; the request is not submitted until verified. Optional restriction to a permitted email domain if the college provides one |
| C-03 | Abuse controls | Rate limiting per email and per IP, CAPTCHA, message length cap, and a blocklist |
| C-04 | Moderation queue | All requests land in an admin queue. Admin can Approve, Reject (with reason), or Block the requester. Auto-forward mode can be enabled per the Association's preference |
| C-05 | Alumnus notification | On approval, the alumnus receives an email containing the requester's details and message, with one-click **Accept** and **Decline** links (signed, single-use, expiring tokens) |
| C-06 | Contact release | Only on **Accept** is the alumnus's chosen contact channel released to the requester by email. On **Decline** or expiry, nothing is released and the requester receives a neutral notification |
| C-07 | Audit trail | Every request and every state change is logged with timestamp and actor |

### 3.4 Admin Panel

| Ref | Item | Description |
|---|---|---|
| A-01 | Secure admin login | Email + password, password complexity rules, account lockout, password reset, session timeout |
| A-02 | Role-based access | **Super Admin** (all rights incl. user management), **Editor** (alumni records only), **Moderator** (connection requests only) |
| A-03 | Alumni record management | Create, read, update, archive (soft-delete). Archived records disappear from the public directory but are retained |
| A-04 | Bulk import | Upload of an Excel/CSV file of alumni records. Includes downloadable template, column mapping, row-level validation, duplicate detection, a **dry-run preview** before commit, and a downloadable error report |
| A-05 | Bulk export | Export the current dataset to CSV for the Association's own records |
| A-06 | Photo management | Upload, crop and replace profile photographs with file-type and size validation |
| A-07 | Connection request management | Moderation queue as described in C-04, with search and status filters |
| A-08 | Admin user management | Super Admin can invite, suspend and remove admin users |
| A-09 | Audit log | Read-only log of who changed what and when, filterable by user and date |
| A-10 | Dashboard | Counts of total alumni, alumni added this year, pending requests, accepted/declined ratios |

### 3.5 Technical Delivery

| Ref | Item | Description |
|---|---|---|
| T-01 | Application build | Frontend, backend and database per §5 |
| T-02 | Environments | Development, Staging (client-accessible for UAT), Production |
| T-03 | Deployment pipeline | Automated build and deploy from the main branch |
| T-04 | Domain cutover | DNS and hosting migration for `www.sxccaa.org`, HTTPS/TLS certificate, redirects preserving any existing indexed URLs |
| T-05 | Backups | Automated daily database backups with a documented restore procedure |
| T-06 | Basic SEO | Semantic markup, meta tags, sitemap, robots.txt. Alumni profile pages will be `noindex` by default unless the Client directs otherwise (see §7) |
| T-07 | Analytics | Privacy-respecting analytics (self-hosted or cookieless) on public pages |

---

## 4. Data Specification

### 4.1 Fields displayed publicly

Full name · Graduation year · Degree / programme · Department · Current company · Designation · Industry · City & country · Short professional bio · Profile photograph · LinkedIn URL · X (Twitter) URL · Areas willing to help with (mentorship, referrals, guest lectures, internships)

### 4.2 Fields stored but never displayed publicly

Email address · Mobile number · Postal address · Date of birth · Roll number / student ID · Internal administrative notes · Consent and visibility flags

Fields in §4.2 are visible only to authenticated admin users, and are subject to the access controls in A-02.

### 4.3 Data ownership

All alumni data remains the property of SXCCAA. On termination or completion, a full database export is handed over in an open format (SQL dump plus CSV).

---

## 5. Technical Approach

| Layer | Technology |
|---|---|
| Frontend | React (with a component library and responsive design system) |
| Backend | Node.js with Express, REST API |
| Database | PostgreSQL |
| Authentication | Server-side sessions or JWT with refresh tokens; bcrypt/argon2 password hashing |
| Email delivery | Transactional email provider (e.g. Amazon SES, Postmark, or SendGrid) — provider to be confirmed with Client |
| File storage | Object storage for profile photographs |
| Hosting | Cloud hosting (provider to be confirmed with Client) |
| Version control | Git, with the repository handed to the Client on completion |

### 5.1 Non-functional requirements

- **Performance:** directory search and filter results returned in under 1 second for a dataset of up to 25,000 records.
- **Browsers:** latest two versions of Chrome, Firefox, Safari and Edge.
- **Accessibility:** public pages built to WCAG 2.1 Level AA where reasonably achievable.
- **Security:** OWASP Top 10 mitigations — parameterised queries, output encoding, CSRF protection, secure headers, encrypted transport, secrets held outside version control.
- **Availability:** target 99.5% monthly uptime for the production environment, subject to the hosting provider's own SLA.

---

## 6. Out of Scope

The following are explicitly **not** included and would require a separate change request or SOW:

- Alumni self-registration or self-service profile editing (see §7 — recommended for Phase 2)
- Online payments, donations, membership fees, or UPI integration
- Event management, ticketing or RSVP functionality
- Job board or placement portal
- Native mobile applications (iOS/Android)
- Direct on-platform messaging or chat between users
- Newsletter/email marketing platform and campaign management
- Automatic scraping or syncing of data from LinkedIn, X, or any third-party platform
- Multilingual or regional-language versions
- Sourcing, cleaning or verifying the alumni dataset itself
- Content writing, photography, or logo/brand design
- Migration of content beyond the existing pages currently live at `sxccaa.org`
- Ongoing hosting fees, domain renewal, email provider costs, or third-party licence fees
- Post-launch support and maintenance beyond the warranty period in §11

---

## 7. Recommendations and Risks Raised by the Vendor

These are flagged now so the Association can make an informed decision before build begins.

**7.1 Publishing alumni email addresses is not advisable.** The brief mentioned displaying email addresses in the directory. Publicly listed addresses are harvested by bots within days and the Association will be the source of the resulting spam. The connection-request flow in §3.3 delivers the same outcome — a student reaches the alumnus — without the exposure. **This SOW is written on the basis that email addresses are not publicly displayed.** If the Association requires them displayed, please raise it during review; it is a scope change, not a defect.

**7.2 Consent is required before publishing personal data.** Under India's Digital Personal Data Protection Act, 2023, publishing an identifiable individual's professional and contact details requires their consent. The Association must be able to demonstrate consent for every record loaded into the directory. The platform supports this with per-record consent flags and an opt-out mechanism, but **obtaining and evidencing consent is the Client's responsibility** (§9).

**7.3 Verifying "current students" has practical limits.** OTP email verification confirms a requester controls an address; it does not prove enrolment. If the college can supply a student email domain, we will restrict requests to it. If not, admin moderation (C-04) is the safeguard, and the Association should expect to actively moderate.

**7.4 The existing site is live.** `sxccaa.org` currently serves event and donor content. The Client must confirm whether the new platform fully replaces it, or whether the existing content is retained under a section of the new site. This decision is needed before Phase 1 ends.

**7.5 Data quality affects the size of the job.** Bulk import (A-04) assumes a reasonably structured spreadsheet. Heavily inconsistent source data — mixed date formats, merged name fields, duplicates across chapters — adds work to Phase 6 and may warrant a separate data-cleaning engagement.

---

## 8. Deliverables

| # | Deliverable | Format |
|---|---|---|
| 1 | Requirements & data dictionary | Document, signed off by Client |
| 2 | Wireframes and visual designs | Figma file or equivalent, signed off by Client |
| 3 | Public website and alumni directory | Deployed application |
| 4 | Connection request system | Deployed application |
| 5 | Admin panel | Deployed application |
| 6 | Bulk import tooling and template | Deployed feature + Excel/CSV template |
| 7 | Source code | Git repository transferred to Client |
| 8 | Deployment & operations runbook | Document |
| 9 | Admin user guide | Document |
| 10 | Admin training session | 1 × live session, recorded |
| 11 | UAT test plan and sign-off record | Document |

---

## 9. Client Responsibilities

Delivery of the phases in §10 depends on the Client providing the following. Work that is blocked awaiting these inputs is paused, not absorbed.

1. A single nominated point of contact empowered to approve designs and sign off phases.
2. The alumni dataset in Excel or CSV, with evidence of consent per §7.2.
3. Association branding — logo, colours, fonts — or approval for us to propose them.
4. All written content: About, Privacy Policy, Terms of Use, contact details.
5. Access to the `sxccaa.org` domain registrar and any existing hosting.
6. A decision on the fate of existing site content (§7.4).
7. Nomination of admin users and their roles.
8. Feedback on each deliverable within **[N] working days** of submission.
9. Payment of all third-party costs — hosting, domain, email provider, licences.

---

## 10. Phases and Work Breakdown

Work is delivered in seven sequential phases. Each phase ends with a review and Client sign-off before the next begins. The "Requirements covered" column maps each phase back to the numbered items in §3, so the full scope is accounted for exactly once.

| Phase | Work performed | Requirements covered |
|---|---|---|
| **0. Discovery & Design** | Requirements workshops, data dictionary for all fields in §4, information architecture, wireframes for every screen, visual design and component library, Client sign-off on designs | Deliverables 1–2 |
| **1. Foundation** | Repository setup, three environments, automated build and deploy pipeline, database schema and migrations, admin authentication, role-based access control | T-01, T-02, T-03, A-01, A-02 |
| **2. Public site & directory** | Home, About, Contact and up to 5 static pages; directory listing with pagination; keyword search; filters; sorting; alumni profile pages; social links; privacy-flag enforcement; empty and edge states; responsive build across mobile, tablet and desktop | P-01 – P-06, D-01 – D-08 |
| **3. Connection requests** | Request form; requester OTP email verification; rate limiting, CAPTCHA and blocklist; admin moderation queue; alumnus notification email; signed accept/decline links; contact release on acceptance; full audit trail | C-01 – C-07 |
| **4. Admin panel** | Alumni create/read/update/archive; bulk import with template, validation, duplicate detection, dry-run preview and error report; bulk export; photo upload and cropping; connection request management; admin user management; audit log; dashboard | A-03 – A-10 |
| **5. Hardening & QA** | Security review against OWASP Top 10; accessibility pass to WCAG 2.1 AA; cross-browser testing; performance tuning against the directory search target; SEO markup and sitemap; analytics; defect resolution | §5.1, T-06, T-07 |
| **6. UAT, data load & launch** | Client UAT support against the agreed test plan; production data import; domain cutover, TLS and redirects; backup configuration and restore test; admin training session; documentation and repository handover | T-04, T-05, Deliverables 7–11 |

**Running throughout:** project coordination, progress reporting and Client review sessions.

**Team composition:** full-stack development, UI/UX design, quality assurance, and project management. Design effort is concentrated in Phases 0–2 and QA effort in Phases 4–6.

**Sequencing note:** Phases 2 and 3 both depend on Phase 1 completing. Phase 6 cannot begin until the Client has supplied the alumni dataset and domain access per §9.

*Schedule and commercial terms are agreed separately between the parties and are not part of this document.*

---

## 11. Acceptance and Warranty

**Acceptance.** Each phase deliverable is submitted to the Client's nominated contact. The Client has **[N] working days** to review and either accept or raise defects in writing. Absent a written response within that window, the deliverable is deemed accepted. Final acceptance occurs on successful completion of UAT against the agreed test plan.

**Definition of a defect.** A failure of the delivered software to perform as described in this SOW and the signed-off requirements document. Requests for behaviour not described in those documents are change requests, not defects.

**Warranty.** [30 / 60 / 90] calendar days from final acceptance, during which defects as defined above are corrected at no additional cost. The warranty excludes issues arising from Client-side data changes, third-party service outages, unauthorised code modification, or new feature requests.

---

## 12. Change Control

Any change to the scope or deliverables set out in this document must be raised as a written Change Request describing the change, the additional work it introduces, and which phase it affects. Work on a change begins only after written approval from the Client's nominated contact. No verbal instruction constitutes an approved change.

---

## 13. Assumptions

1. Only the features listed in §3 are in scope; everything in §6 is excluded.
2. Alumni email addresses are not publicly displayed (§7.1).
3. The Client supplies all content and imagery; we do not write or source it.
4. One design language applies across the site; no separate chapter-specific themes.
5. The dataset is a single consolidated list, not per-chapter databases requiring reconciliation.
6. Hosting and third-party accounts are held in the Client's name and billed to the Client.
7. Work is performed remotely; on-site attendance is not included.
8. Communication and documentation are in English.

---

## 14. Sign-off

By signing below, both parties agree to the scope, deliverables, effort and terms set out in this Statement of Work.

| | Client | Vendor |
|---|---|---|
| **Name** | | |
| **Designation** | | |
| **Organisation** | SXCCAA | [Your organisation] |
| **Signature** | | |
| **Date** | | |

---

### Appendix A — Placeholders to complete before issuing

- [ ] Confirm the Association's exact legal name
- [ ] Prepared by / Prepared for names
- [ ] Document date
- [ ] Client feedback window — `[N] working days` (§9.8, §11)
- [ ] Warranty period — 30 / 60 / 90 days (§11)
- [ ] Commercial terms (separate document or annexure)
- [ ] Hosting and email provider selection (§5)
- [ ] Decision on §7.1 (public email display) and §7.4 (existing site content)
