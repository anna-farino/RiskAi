import { Request, Response } from "express";
import { extractArticleEntities } from "../../../services/openai";

// POST /api/tech-stack/validate-entity - Validate entity type before adding
export async function validateEntity(req: any, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { name, currentType } = req.body;
    if (!name || !currentType) {
      return res.status(400).json({ error: "Name and type are required" });
    }

    // Use our existing AI extraction to determine the best category
    const contextString = `User is trying to add "${name}" to their ${currentType} list.`;

    const extracted = await extractArticleEntities({
      title: `Entity Classification: ${name}`,
      content: contextString + " " + name,
      url: "entity-validation",
    });

    // Determine suggested type based on extraction results
    let suggestedType = currentType;
    let confidence = 0;
    let entityDetails = null;

    if (extracted.software?.length > 0) {
      const software = extracted.software[0];
      if (software.confidence > confidence) {
        suggestedType = 'software';
        confidence = software.confidence;
        entityDetails = {
          vendor: software.vendor,
          category: software.category,
          version: software.version
        };
      }
    }

    if (extracted.hardware?.length > 0) {
      const hardware = extracted.hardware[0];
      if (hardware.confidence > confidence) {
        suggestedType = 'hardware';
        confidence = hardware.confidence;
        entityDetails = {
          manufacturer: hardware.manufacturer,
          model: hardware.model,
          category: hardware.category
        };
      }
    }

    if (extracted.companies?.length > 0) {
      const company = extracted.companies[0];
      // Check if it's more likely a vendor or client based on context
      if (company.confidence > confidence) {
        // If adding to software/hardware but it's a company, suggest vendor
        if (currentType === 'software' || currentType === 'hardware') {
          suggestedType = 'vendor';
        } else if (currentType === 'vendor' || currentType === 'client') {
          // Keep the current type if already in company categories
          suggestedType = currentType;
        }
        confidence = company.confidence;
        entityDetails = {
          type: company.type
        };
      }
    }

    // If confidence is high and types don't match, suggest correction
    const shouldSuggestCorrection =
      suggestedType !== currentType &&
      confidence >= 0.7;

    res.json({
      currentType,
      suggestedType,
      confidence,
      shouldSuggestCorrection,
      entityDetails,
      message: shouldSuggestCorrection
        ? `"${name}" appears to be ${suggestedType === 'vendor' || suggestedType === 'client' ? 'a' : ''} ${suggestedType}. Would you like to add it there instead?`
        : null
    });

  } catch (error) {
    console.error("Error validating entity type:", error);
    res.status(500).json({ error: "Failed to validate entity type" });
  }
}
