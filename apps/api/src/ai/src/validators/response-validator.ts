/**
 * Response Validators — Deterministic post-LLM quality checks.
 *
 * These validators run AFTER the LLM generates a response but BEFORE
 * it's sent to the user. They catch common formatting errors, structural
 * issues, and safety violations WITHOUT adding LLM latency.
 *
 * All validators are pure functions — no I/O, no LLM calls.
 */

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
}

// ── Chat Response Validator ─────────────────────────────────────────

/**
 * Validates Chat response text for formatting compliance.
 * Catches leaked markdown, broken tags, and forbidden patterns.
 */
export function validateChatResponse(text: string): ValidationResult {
  const issues: string[] = [];

  // 1. No markdown headers leaked (###, ##, #)
  if (/^#{1,3}\s/m.test(text)) {
    issues.push("MARKDOWN_HEADERS: Response contains ### headers");
  }

  // 2. No bullet points (- item or * item at line start)
  if (/^\s*[-*]\s+\S/m.test(text)) {
    // Exclude lines that are part of <nutr> technical block
    const narrativeBlock = text.split(/Записал\s/)[0] || text;
    if (/^\s*[-*]\s+\S/m.test(narrativeBlock)) {
      issues.push("MARKDOWN_BULLETS: Narrative contains bullet points");
    }
  }

  // 3. Unclosed <nutr> tags
  const openTags = (text.match(/<nutr[^>]*>/g) || []).length;
  const closeTags = (text.match(/<\/nutr>/g) || []).length;
  if (openTags !== closeTags) {
    issues.push(`UNCLOSED_TAGS: ${openTags} open vs ${closeTags} close nutr tags`);
  }

  // 4. No <nutr type="micro"> in narrative (only allowed after "Записал")
  const narrativeBlock = text.split(/Записал\s/)[0] || text;
  if (/<nutr\s+type=["']micro["']/.test(narrativeBlock)) {
    issues.push("MICRO_IN_NARRATIVE: type='micro' found outside technical block");
  }

  // 5. No image placeholders
  if (/\[Image of/i.test(text)) {
    issues.push("IMAGE_PLACEHOLDER: Contains [Image of...] placeholder");
  }

  // 6. Typo tags: <nutrtr>, <nutrr>, etc.
  if (/<nutr[rt]{2,}/.test(text)) {
    issues.push("TAG_TYPO: Detected malformed nutr tag (e.g. <nutrtr>)");
  }

  // 7. Word boundary: tag should not break a word mid-syllable
  // Example bad: <nutr type="marker">магни</nutr>й  
  if (/<\/nutr>[а-яёА-ЯЁ]/u.test(text)) {
    issues.push("WORD_BOUNDARY: Closing </nutr> tag followed by Cyrillic (word split)");
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

// ── Lab Report Validator ────────────────────────────────────────────

/**
 * Validates Lab Report structural completeness.
 * Ensures all biomarkers are covered and food zones are non-empty.
 */
export function validateLabReport(
  report: any,
  expectedBiomarkerCount: number,
): ValidationResult {
  const issues: string[] = [];

  // 1. All biomarkers assessed
  const actualCount = report?.biomarker_assessments?.length || 0;
  if (actualCount < expectedBiomarkerCount) {
    issues.push(`MISSING_ASSESSMENTS: Got ${actualCount}, expected ${expectedBiomarkerCount}`);
  }

  // 2. Food zones must not be empty (medical safety requirement)
  if (!report?.food_zones?.red?.length) {
    issues.push("EMPTY_RED_ZONE: food_zones.red is empty — must have at least 1 restriction");
  }

  if (!report?.food_zones?.green?.length) {
    issues.push("EMPTY_GREEN_ZONE: food_zones.green is empty — must have at least 1 recommendation");
  }

  // 3. Summary must exist
  if (!report?.summary || report.summary.length < 20) {
    issues.push("MISSING_SUMMARY: report.summary is empty or too short");
  }

  // 4. Disclaimer must exist
  if (!report?.disclaimer) {
    issues.push("MISSING_DISCLAIMER: report.disclaimer is empty");
  }

  // 5. At least one diagnostic pattern for non-trivial analyses
  if (expectedBiomarkerCount >= 5 && (!report?.diagnostic_patterns?.length)) {
    issues.push("NO_PATTERNS: No diagnostic patterns detected with 5+ biomarkers");
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

// ── Food Vision Validator ───────────────────────────────────────────

/**
 * Validates Food Vision response sanity.
 * Checks that items/supplements exist and have valid numeric values.
 */
export function validateFoodVision(result: any): ValidationResult {
  const issues: string[] = [];

  // 1. Must detect SOMETHING (food or supplements)
  const hasItems = result?.items?.length > 0;
  const hasSupplements = result?.supplements?.length > 0;
  if (!hasItems && !hasSupplements) {
    issues.push("NO_ITEMS: Neither food items nor supplements detected");
  }

  // 2. Validate individual items
  if (hasItems) {
    for (const item of result.items) {
      const calories = item.calories_kcal ?? item.calories ?? 0;
      if (calories < 0) {
        issues.push(`NEGATIVE_CALORIES: ${item.name_ru || "Unknown"} has negative calories`);
      }
      if ((item.weight_g ?? 0) <= 0) {
        issues.push(`ZERO_WEIGHT: ${item.name_ru || "Unknown"} has zero or negative weight`);
      }
    }
  }

  // 3. Health reaction must exist and be non-empty
  if (!result?.health_reaction || result.health_reaction.length < 10) {
    issues.push("MISSING_REACTION: health_reaction is empty or too short");
  }

  // 4. Quality score sanity
  const score = result?.meal_quality_score;
  if (score !== undefined && score !== null) {
    if (score < 0 || score > 100) {
      issues.push(`SCORE_OUT_OF_RANGE: meal_quality_score=${score} (must be 0-100)`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}
