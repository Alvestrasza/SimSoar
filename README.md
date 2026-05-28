# SimSoar – Multi-User Virtual Gliding Portal

<!--
doc_type: Installation Documentation
template_version: v0.1.0
document_version: v0.1.2
created: 2026-05-14
last_updated: 2026-05-28
status: Draft
classification: Internal
owner: FlightClub / Alvestrasza Corporation
technical_owner: Internal IT
service_area: simsoar / flightclub
system_scope: Next.js, Keycloak, PostgreSQL, IGC upload and analysis
review_cycle: 6 months
ai_readable: true
source_of_truth: Git / Wiki.js
language: en-US
-->


**SimSoar** is a virtual gliding portal for simulator pilots who want to record, analyze, compare, and share their soaring flights.

The project is designed as a dedicated community platform for virtual glider pilots using modern flight simulators such as Microsoft Flight Simulator, Condor, X-Plane, and compatible soaring tools.

SimSoar is not meant to be just another file upload page. Its long-term goal is to become a structured, multi-user flight logbook and ranking platform for virtual soaring — with meaningful flight analysis, pilot profiles, public leaderboards, and a clean foundation for future community features.

---

## Purpose

SimSoar exists to give virtual glider pilots a place where their flights can be collected, understood, and compared in a more meaningful way.

A glider flight is more than a distance value. It contains route decisions, climb phases, thermal use, altitude management, weather interpretation, risk, patience, and pilot skill. SimSoar aims to make these elements visible.

The platform is intended to support:

- upload and analysis of IGC flight logs
- personal pilot profiles and callsigns
- individual flight histories
- public flight listings and leaderboards
- basic soaring performance analysis
- thermal and climb detection
- altitude and route visualization
- simulator-based virtual gliding communities

---

## Vision

The long-term vision of SimSoar is to become a reliable and enjoyable home for virtual soaring.

SimSoar should allow pilots to:

- document their virtual flights over time
- compare flights with other pilots
- review altitude profiles and climb behavior
- identify strong thermals and key route decisions
- build a recognizable pilot profile
- participate in rankings, events, and future competitions
- share flights without relying on temporary screenshots or disconnected tools

The project should stay focused, clean, and practical. It should serve the flying experience, not bury it under unnecessary complexity.

---

## Core Features

Planned and partially implemented core features include:

- multi-user platform for virtual glider pilots
- login through an external identity provider
- pilot profile with callsign and personal flight history
- IGC file upload
- server-side IGC validation
- flight distance calculation
- altitude profile extraction
- basic vario and climb analysis
- thermal detection
- public flight overview
- public leaderboard
- prepared map-based flight visualization

---

## Target Audience

SimSoar is intended for:

- virtual glider pilots
- flight simulator communities
- soaring clubs using simulators
- pilots who want to compare and analyze IGC files
- users of MSFS, Condor, X-Plane, and similar platforms
- small communities that want their own independent soaring portal

---

## Design Principles

SimSoar follows a few simple principles:

1. **Flights first**  
   The uploaded flight and its analysis are the center of the platform.

2. **Community without clutter**  
   The platform should support pilots and rankings without becoming overloaded.

3. **Readable flight data**  
   Distance, altitude, climb behavior, and thermal phases should be understandable at a glance.

4. **Independent operation**  
   SimSoar should be able to run on self-hosted infrastructure.

5. **Clean separation of code and runtime data**  
   Source code belongs in Git. Secrets, uploads, logs, and operational data belong outside the repository.

6. **Extensible architecture**  
   Future features such as events, moderation, advanced scoring, or object storage should be possible without redesigning the entire system.

---

## Technical Direction

SimSoar is developed as a modern web application based on:

- Next.js
- Node.js
- Prisma
- PostgreSQL
- external authentication through OpenID Connect / Keycloak
- server-side IGC processing
- optional reverse proxy deployment

The project is prepared for classic self-hosted operation on Linux servers. It is intentionally not limited to a specific cloud provider.

Operational configuration, secrets, uploaded flight files, certificates, logs, and environment files are not part of the source repository.

---

## Repository Scope

This repository contains the application source code and project files required to develop SimSoar.

It should contain:

- application source code
- UI components
- server-side logic
- database schema and migrations
- public static assets
- deployment templates where useful
- documentation relevant to development

It must not contain:

- production secrets
- environment files with real values
- private keys or certificates
- uploaded user files
- runtime logs
- build artifacts
- dependency directories such as `node_modules`

---

## Current Project Status

SimSoar is currently in active development.

The foundation is being prepared for a proper multi-user architecture, persistent database storage, authenticated access, and future public flight comparison features.

The project is not yet considered a finished production platform. Interfaces, data models, and deployment details may still change while the core system is being stabilized.

---

## Planned Roadmap

Possible next development stages include:

- stable pilot profile system
- improved IGC parser and validation
- proper track visualization on interactive maps
- detailed altitude and climb charts
- improved thermal detection
- public and private flight visibility options
- moderation workflow for public uploads
- event and competition support
- role-based administration
- audit logging
- optional object storage for uploaded files
- improved scoring and leaderboard logic

---

## Project Goal

The goal of SimSoar is simple:

> Build a clean, independent, community-oriented platform where virtual glider flights can be uploaded, analyzed, compared, and remembered.

SimSoar should make virtual soaring more visible, more structured, and more rewarding — without losing the calm, focused nature of gliding itself.

