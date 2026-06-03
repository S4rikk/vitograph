# Dynamic Semantic OCR Architecture for Wearables

**Date:** 2026-06-03
**Status:** Approved for Implementation

## Overview
Replaced the rigid paid-API integrations with an advanced, schema-less Computer Vision OCR strategy. The system processes screenshots from any fitness app and maps extracted numbers to semantic context using `gpt-5.4-vision-pro`.

## 1. Backend Changes (AI Layer)
File: `apps/api/src/ai/src/graph/wearable-vision-analyzer.ts`

The previous `UnifiedWearableSchema` hardcoded 20 static metrics. The new `DynamicWearableSchema` returns an array of objects:
- `originalName`
- `standardizedCategory`
- `semanticMeaning`
- `value`
- `unit`
- `confidence`

This ensures that the AI contextualizes every metric it sees, enabling downstream systems (e.g. kOSI core) to reason about "Body Battery" or "Strain" without needing hardcoded mappings.

## 2. Database Changes
File: `apps/api/migrations/033_dynamic_wearable_metrics.sql`

Added a `JSONB` column `semantic_metrics` to the wearable history tables. This decouples the database schema from the endless permutations of hardware metrics across Garmin, Oura, Apple, Whoop, etc.

## 3. Frontend Changes
File: `apps/web/src/components/profile/UserProfileSheet.tsx`

The OCR parsing flow now displays a Dynamic Entry Dialog. Instead of predefined inputs, the React component maps over the `extractedMetrics` array, displaying the `originalName`, the `semanticMeaning` (as helper text), and the pre-filled `value`. Users can edit or delete rows before saving to the `JSONB` structure in the database.
