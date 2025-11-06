# Fact Extraction Guidelines

## Principles

1. **Explicit Only**: Only extract facts explicitly stated in the article
2. **Evidence Required**: Every fact must have a supporting quote
3. **No Inference**: Don't guess or infer - use null for unclear facts
4. **Conservative**: When in doubt, mark as null rather than false

## Extraction Rules

### Exploitation Facts

**is_actively_exploited**: true/false/null
- true: Article explicitly states active exploitation
- false: Article explicitly states no active exploitation
- null: Not mentioned or unclear

Examples:
- ✅ "attackers are actively exploiting this vulnerability" → true
- ✅ "currently being used in attacks" → true
- ✅ "no evidence of exploitation in the wild" → false
- ❌ "could be exploited" → null (potential, not active)

**is_zero_day**: true/false/null
- true: Explicitly called zero-day OR states no patch existed when discovered
- false: Vulnerability was known/patched before exploitation
- null: Not mentioned

### Impact Facts

**allows_remote_code_execution**: true/false/null
- Keywords: "remote code execution", "RCE", "arbitrary code execution", "execute commands remotely"
- Be strict: "could allow code execution" → null (potential, not confirmed)

**scope**: limited/moderate/widespread/critical_infrastructure/null
- critical_infrastructure: Explicitly mentions power, water, healthcare, finance, government
- widespread: Mentions "widespread", "global", "millions of systems"
- moderate: Mentions specific sector or region
- limited: Single organization or small group
- null: Not specified

## Evidence Format

Evidence should be:
1. Direct quote from article (verbatim)
2. Concise (1-3 sentences max)
3. Clearly supports the extracted fact

Example:
```json
{
  "is_actively_exploited": true,
  "evidence": "Security researchers have observed active exploitation of CVE-2024-1234 in the wild, with attackers using this vulnerability to compromise over 500 systems in the past week."
}
```

## Common Mistakes to Avoid

1. **Inferring from keywords**: Don't assume "ransomware" = allows_data_exfiltration
2. **Conflating potential with actual**: "could allow" ≠ "allows"
3. **Over-extracting**: Don't extract every possible fact - focus on clearly stated ones
4. **Under-evidencing**: Generic evidence like "mentioned in article" is insufficient
