# What you need to do

**Right now: nothing.** That is not a placeholder answer — read on.

Decisions so far: **Android only**, **Expo SDK 57**, **no paid services**, **no hosting
yet**. Between them they removed every urgent task this file used to have.

---

## 1. What "free, not hosted" actually gets you

You can build and run the entire app for **₹0**, today, on your own phone.

| | Cost | Status |
|---|---|---|
| Expo SDK 57 + Expo Go on your phone | free | ✅ working now |
| Running the website on your computer | free | ✅ working now |
| Supabase database | free tier | ✅ already yours |
| Every screen: home, events, sign-in, directory, profile, event photos | free | being built |
| In-app notification feed | free | phase 6 |

**The catch, and it is the only one:** the app talks to the website running on your
computer, over your Wi-Fi. So it works when your laptop is on and your phone is on the same
network. That is completely fine for building it and for showing the client. It is not a
thing alumni can download yet.

---

## 2. The two things that are not free, and when they bite

Neither is needed now. Both are cheap.

### Publishing to the Play Store — **$25, once**

This is Google's registration fee and there is no free alternative. It is a one-time
payment, not yearly.

You only need it when you actually want alumni to install the app. Until then, skip it.

> When you do get to it: choose **Organisation**, not Personal. Personal accounts must run
> a closed test with 12 testers for 14 continuous days before they may even apply to
> publish. Organisation accounts skip that. The choice cannot be changed later.

### Hosting the website — **free tiers exist**

The app needs the website reachable on the internet before it works away from your Wi-Fi.
When you get there, this can also be free:

- **Vercel Hobby** — free, made for Next.js, works with your existing Supabase
- **GitHub Actions** — free, and can run the scheduled job that sends notifications

I will walk you through it when you want it. Nothing about it blocks the build.

---

## 3. One technical catch, flagged early

**Push notifications will not work in Expo Go.** Not a bug and not something I can code
around — Expo removed Android push from Expo Go in SDK 53. I checked the package source
rather than going from memory:

> *"Android Push notifications (remote notifications) functionality provided by
> expo-notifications was removed from Expo Go with the release of SDK 53."*

What this means in practice:

| | Works in Expo Go | Needs a development build |
|---|---|---|
| Every screen, sign-in, photos, directory | ✅ | |
| The in-app "Updates" list | ✅ | |
| A notification arriving on your lock screen | | ⚠️ yes |

A **development build** is just a version of the app installed properly on your phone
instead of running inside Expo Go. It is still free — either through Expo's free build tier
(a queue wait, no card) or by installing Android Studio locally. I will set it up when we
reach phase 6.

**Nothing before phase 6 is affected.** We keep using Expo Go until then.

---

## 4. Decisions I need eventually — no rush

### 4.1 The app's permanent name

| What | My suggestion |
|---|---|
| Play listing name | `SXCCAA Alumni` |
| Android identifier | `org.sxccaa.alumni` |

The identifier freezes at the first Play submission — changing it later makes a *different*
app that existing users never get as an update. Since you are not publishing yet, there is
time. Just say "fine" or tell me otherwise.

### 4.2 The app icon

Already made, from the **real College crest** — NIHIL ULTRA on the ribbon, on the
Association's black. It is at `mobile/assets/icon.png`.

One honest caveat: a launcher icon is about a fingernail's size, and the crest's ring
lettering ("ST XAVIER'S COLLEGE", "CALCUTTA") will not be legible that small. The shape and
colours still read as the crest, which is what most institutional apps do.

- **Keep it** — recognisably the College, slightly mushy small. My default.
- **Simplify it** — just the shield, no outer ring or ribbon. Cleaner small.

### 4.3 Who removes a bad photograph

Alumni will be able to post a photo straight into an event album, and it appears
**immediately** — no approval queue, because this project's own history shows a queue
nobody staffs means photos never appear at all.

That only works if a person can remove one. I need **one or two named volunteers** and a
**target response time** ("within 24 hours" is fine). This matters before the app is public,
not before it is built.

---

## 5. The one thing that will block publishing, whenever you get there

`/privacy-policy` and `/terms-of-use` on the website are **empty placeholders** today.

**Google Play hard-rejects an app without a working privacy policy URL.** Since the app
handles phone numbers and photographs of identifiable people, it needs real content rather
than boilerplate.

It should come from the Association and be checked by whoever advised on the data-consent
commitments. **I can draft a structure for someone to fill in — just ask.**

---

## 6. How to see the app on your phone right now

1. Install **Expo Go** from the Play Store
2. On your computer:

```bash
cd oxvercity && npm run dev
```

3. In a second terminal:

```bash
cd mobile && npx expo start
```

4. A square barcode appears. Open Expo Go and scan it
5. Phone and computer must be on the **same Wi-Fi**

The app finds the website by itself — it reads the address from the connection Expo is
already using, so there is nothing to type in.

### Trying the sign-in screen

Signing in needs a six-digit code, which normally arrives by email — and there is no mail
provider configured yet. So there is a tool that gives you a code you can just type:

```bash
cd oxvercity && npm run app:demo-user
```

It prints an address and the code `246810`. The order matters:

1. In the app, type the address and tap **Send me a code**
2. **Then** run the command above again
3. Type the code it prints

That middle step is not fussiness. Asking for a code cancels any code already outstanding —
the system makes sure "this is your code" is always true — so running the tool first and
tapping the button afterwards quietly invalidates the code you were about to use.

When you are done:

```bash
cd oxvercity && npm run app:demo-user -- --remove
```

---

## 7. What is built

| | Status |
|---|---|
| Server foundations (`/api/app/v1`) | ✅ 79 checks passing |
| App shell, fonts, five tabs, offline content cache | ✅ |
| App icon from the College crest | ✅ |
| Android config, minimal permissions | ✅ |
| Home screen | ✅ real content |
| Events screen with filters | ✅ real content |
| **Sign in, sign out, session handling** | ✅ **46 checks passing** |
| About / Chapters / Contact pages | ← next |
| Alumni directory and your profile | after |
| Event photographs | after |
| Notifications | last (needs the dev build in §3) |

Runs on **Android 7.0 and newer** — effectively every phone in use. Requests five
permissions: internet, camera, notifications, photo library, vibrate. I removed six more
that libraries had quietly added, including location, microphone, and "draw over other
apps".

The website is untouched: its own 187 tests and every security check still pass, re-run
after each change.

---

## Summary

**Your action this week: none.** Install Expo Go if you want to watch it come together.

The $25 and the hosting are real but deferred, and neither blocks a single thing I am
doing. I will keep building.
