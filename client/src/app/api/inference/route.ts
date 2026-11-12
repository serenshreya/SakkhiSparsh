// ============================================================
// GET  /api/inference — Proxy inference server health check
// POST /api/inference — Upload → inference → save findings to DB
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { INFERENCE_URL, STORAGE_BUCKETS, MODEL_VERSION } from '@/lib/constants';
import type { TriageTier, RiskTier } from '@/lib/types';
import { triageToRisk } from '@/lib/types';

export async function GET() {
  try {
    const response = await fetch(`${INFERENCE_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(`Inference server returned ${response.status}`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    // Inference server is unreachable — report as demo mode
    return NextResponse.json({
      status: 'unreachable',
      model_loaded: false,
      demo_mode: true,
      model_version: MODEL_VERSION + '-offline',
      files: { onnx: false, encoders: false, glcm_config: false },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { scanId } = await request.json();
    if (!scanId) {
      return NextResponse.json({ error: 'scanId is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 1. Update scan status to processing
    await supabase
      .from('scans')
      .update({ status: 'processing' })
      .eq('id', scanId);

    // 2. Fetch scan record
    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .select('*')
      .eq('id', scanId)
      .single();

    if (scanError || !scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    // 3. Download image from Supabase Storage
    const { data: imageData, error: downloadError } = await supabase.storage
      .from(STORAGE_BUCKETS.SCAN_IMAGES)
      .download(scan.image_url);

    if (downloadError || !imageData) {
      await supabase.from('scans').update({ status: 'error' }).eq('id', scanId);
      return NextResponse.json({ error: 'Failed to download image' }, { status: 500 });
    }

    // 4. Call inference endpoint
    let inferenceResult;
    try {
      const formData = new FormData();
      formData.append('file', imageData, 'scan.jpg');

      const inferenceResponse = await fetch(`${INFERENCE_URL}/predict-with-gradcam`, {
        method: 'POST',
        body: formData,
      });

      if (!inferenceResponse.ok) {
        throw new Error(`Inference returned ${inferenceResponse.status}`);
      }

      inferenceResult = await inferenceResponse.json();
    } catch (inferErr) {
      console.error('Inference service error:', inferErr);
      // Fallback: use demo prediction if inference service is down
      inferenceResult = {
        triage: { tier: 'uncertain' as TriageTier, confidence: 0.5 },
        differential: [
          { condition: 'pending_analysis', confidence: 1.0 },
        ],
        minor_signs: {
          asymmetry_score: null,
          border_irregularity: null,
          color_variation: null,
          diameter_estimate: null,
        },
        model_version: MODEL_VERSION + '-fallback',
        gradcam_base64: null,
      };
    }

    // 5. Upload Grad-CAM heatmap if available
    let gradcamUrl: string | null = null;
    if (inferenceResult.gradcam_base64) {
      try {
        const buffer = Buffer.from(inferenceResult.gradcam_base64, 'base64');
        const heatmapPath = `${scanId}/gradcam.png`;

        const { error: heatmapError } = await supabase.storage
          .from(STORAGE_BUCKETS.GRADCAM_HEATMAPS)
          .upload(heatmapPath, buffer, {
            contentType: 'image/png',
            upsert: true,
          });

        if (!heatmapError) {
          gradcamUrl = heatmapPath;
        }
      } catch (e) {
        console.error('Grad-CAM upload error:', e);
      }
    }

    // 6. Write findings to DB
    const { data: finding, error: findingError } = await supabase
      .from('findings')
      .insert({
        scan_id: scanId,
        triage_tier: inferenceResult.triage.tier,
        differential: inferenceResult.differential,
        minor_signs: inferenceResult.minor_signs,
        confidence_score: inferenceResult.triage.confidence,
        gradcam_url: gradcamUrl,
        model_version: inferenceResult.model_version,
      })
      .select('id')
      .single();

    if (findingError) {
      console.error('Finding insert error:', findingError);
      await supabase.from('scans').update({ status: 'error' }).eq('id', scanId);
      return NextResponse.json({ error: 'Failed to save findings' }, { status: 500 });
    }

    // 7. Look up Ayurveda condition map for top differential
    const topCondition = inferenceResult.differential?.[0]?.condition;
    let ayurvedaMapId: string | null = null;
    let ayurvedaAdvice = {};
    let allopathyAdvice = {};

    if (topCondition && topCondition !== 'pending_analysis') {
      const { data: ayurvedaMap } = await supabase
        .from('ayurveda_condition_map')
        .select('*')
        .eq('modern_condition', topCondition)
        .single();

      if (ayurvedaMap) {
        ayurvedaMapId = ayurvedaMap.id;
        ayurvedaAdvice = {
          dosha_classification: ayurvedaMap.dosha_classification,
          dietary_notes: ayurvedaMap.dietary_notes,
          lifestyle_notes: ayurvedaMap.lifestyle_notes,
          classical_reference: ayurvedaMap.classical_reference,
        };
      }
    }

    // Build allopathy advice based on risk tier
    const riskTier: RiskTier = triageToRisk(inferenceResult.triage.tier);
    allopathyAdvice = buildAllopathyAdvice(inferenceResult.triage.tier, topCondition);

    // 8. Write recommendation
    await supabase.from('recommendations').insert({
      finding_id: finding!.id,
      risk_tier: riskTier,
      ayurveda_advice: ayurvedaAdvice,
      allopathy_advice: allopathyAdvice,
      ayurveda_condition_map_id: ayurvedaMapId,
    });

    // 9. Update scan status to awaiting_verification for doctor review
    await supabase
      .from('scans')
      .update({ status: 'awaiting_verification' })
      .eq('id', scanId);

    return NextResponse.json({
      success: true,
      findingId: finding!.id,
      triage: inferenceResult.triage,
    });

  } catch (err) {
    console.error('Inference API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


function buildAllopathyAdvice(triageTier: TriageTier, condition: string | undefined) {
  const base = {
    condition_category: condition?.replace(/_/g, ' ') || 'Unknown',
  };

  switch (triageTier) {
    case 'benign':
      return {
        ...base,
        urgency: 'Routine',
        next_steps: [
          'Continue monitoring for any changes in size, shape, or color.',
          'Schedule a routine dermatology check-up if not done in the past year.',
          'No immediate medical intervention expected to be necessary.',
        ],
      };
    case 'uncertain':
      return {
        ...base,
        urgency: 'Follow-up recommended within 2-4 weeks',
        next_steps: [
          'Schedule an appointment with a dermatologist for clinical evaluation.',
          'Dermoscopic examination may be warranted for a definitive assessment.',
          'Monitor for any rapid changes and report immediately.',
          'Consider biopsy if clinically indicated by the examining physician.',
        ],
      };
    case 'malignant_suspect':
      return {
        ...base,
        urgency: 'Urgent — referral within 1-2 weeks',
        next_steps: [
          'Urgent referral to a dermatologist or dermatology-oncology specialist.',
          'Biopsy and histopathological examination strongly recommended.',
          'Do not delay — early detection significantly improves outcomes.',
          'Full-body skin examination may be advisable.',
        ],
      };
  }
}
