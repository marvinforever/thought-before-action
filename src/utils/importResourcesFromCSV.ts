import { supabase } from "@/integrations/supabase/client";

export interface CSVResource {
  title: string;
  description: string;
  url: string;
  content_type: 'article' | 'video' | 'book' | 'podcast' | 'course';
  capability_names: string; // Pipe-separated: "Leadership|Communication"
  capability_level: 'foundational' | 'advancing' | 'independent' | 'mastery';
  authors?: string;
  publisher?: string;
  rating?: number;
  estimated_time_minutes?: number;
}

function mapCapabilityLevel(level: string): 'foundational' | 'advancing' | 'independent' | 'mastery' {
  const normalized = level.toLowerCase();
  if (normalized === 'beginner') return 'foundational';
  if (normalized === 'intermediate') return 'advancing';
  if (normalized === 'advanced') return 'independent';
  if (normalized === 'expert') return 'mastery';
  return normalized as any;
}

export interface ImportResult {
  success: boolean;
  row: number;
  title: string;
  error?: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function parseCSV(csvText: string): CSVResource[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const resources: CSVResource[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const resource: any = {};
    
    headers.forEach((header, index) => {
      let value = values[index]?.trim() || '';
      // Remove surrounding quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      resource[header] = value;
    });
    
    // Convert rating and time to numbers if present
    if (resource.rating) resource.rating = parseFloat(resource.rating);
    if (resource.estimated_time_minutes) resource.estimated_time_minutes = parseInt(resource.estimated_time_minutes);
    
    resources.push(resource as CSVResource);
  }
  
  return resources;
}

async function lookupCapabilityIds(capabilityNames: string[]): Promise<Map<string, string>> {
  const { data: capabilities, error } = await supabase
    .from('capabilities')
    .select('id, name')
    .in('name', capabilityNames);
  
  if (error) throw error;
  
  const map = new Map<string, string>();
  capabilities?.forEach(cap => {
    map.set(cap.name.toLowerCase(), cap.id);
  });
  
  return map;
}

export async function importResourcesFromCSV(
  csvText: string,
  companyId: string
): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  
  try {
    const resources = parseCSV(csvText);
    
    if (resources.length === 0) {
      return [{ success: false, row: 0, title: 'CSV Parse Error', error: 'No valid rows found in CSV' }];
    }
    
    // Collect all unique capability names
    const allCapabilityNames = new Set<string>();
    resources.forEach(resource => {
      const names = resource.capability_names.split('|').map(n => n.trim()).filter(n => n);
      names.forEach(name => allCapabilityNames.add(name));
    });
    
    // Look up all capability IDs at once
    const capabilityMap = await lookupCapabilityIds(Array.from(allCapabilityNames));
    
    // Process each resource
    for (let i = 0; i < resources.length; i++) {
      const resource = resources[i];
      const rowNum = i + 2; // +2 because of header row and 0-indexing
      
      try {
        // Validate required fields
        if (!resource.title) {
          results.push({
            success: false,
            row: rowNum,
            title: 'Unknown',
            error: 'Missing title'
          });
          continue;
        }
        
        if (!resource.content_type) {
          results.push({
            success: false,
            row: rowNum,
            title: resource.title,
            error: 'Missing content_type'
          });
          continue;
        }
        
        if (!resource.capability_names) {
          results.push({
            success: false,
            row: rowNum,
            title: resource.title,
            error: 'Missing capability_names'
          });
          continue;
        }
        
        // Parse capability names
        const capabilityNames = resource.capability_names.split('|').map(n => n.trim()).filter(n => n);
        
        if (capabilityNames.length === 0) {
          results.push({
            success: false,
            row: rowNum,
            title: resource.title,
            error: 'No valid capability names provided'
          });
          continue;
        }
        
        // Find capability IDs
        const capabilityIds: string[] = [];
        const missingCapabilities: string[] = [];
        
        for (const name of capabilityNames) {
          const capId = capabilityMap.get(name.toLowerCase());
          if (capId) {
            capabilityIds.push(capId);
          } else {
            missingCapabilities.push(name);
          }
        }
        
        if (missingCapabilities.length > 0) {
          results.push({
            success: false,
            row: rowNum,
            title: resource.title,
            error: `Capability not found: ${missingCapabilities.join(', ')}`
          });
          continue;
        }
        
        // Insert resource
        const { data: insertedResource, error: resourceError } = await supabase
          .from('resources')
          .insert([{
            company_id: companyId,
            title: resource.title,
            description: resource.description || null,
            external_url: resource.url || null,
            content_type: resource.content_type,
            capability_level: mapCapabilityLevel(resource.capability_level || 'advancing'),
            authors: resource.authors || null,
            publisher: resource.publisher || null,
            rating: resource.rating || null,
            estimated_time_minutes: resource.estimated_time_minutes || null,
            is_active: true
          }])
          .select()
          .single();
        
        if (resourceError) throw resourceError;
        
        // Insert capability links
        const capabilityLinks = capabilityIds.map(capId => ({
          resource_id: insertedResource.id,
          capability_id: capId
        }));
        
        const { error: linkError } = await supabase
          .from('resource_capabilities')
          .insert(capabilityLinks);
        
        if (linkError) throw linkError;
        
        results.push({
          success: true,
          row: rowNum,
          title: resource.title
        });
        
      } catch (error: any) {
        results.push({
          success: false,
          row: rowNum,
          title: resource.title,
          error: error.message
        });
      }
    }
    
  } catch (error: any) {
    return [{ success: false, row: 0, title: 'Import Error', error: error.message }];
  }
  
  return results;
}

export function generateCSVTemplate(): string {
  const headers = [
    'title',
    'description',
    'url',
    'content_type',
    'capability_names',
    'capability_level',
    'authors',
    'publisher',
    'rating',
    'estimated_time_minutes'
  ];
  
  const exampleRow = [
    '"Leading with Empathy"',
    '"A comprehensive guide to empathetic leadership"',
    '"https://example.com/resource"',
    '"book"',
    '"Leadership|Communication"',
    '"intermediate"',
    '"John Doe"',
    '"Example Publisher"',
    '4.5',
    '120'
  ];
  
  return [headers.join(','), exampleRow.join(',')].join('\n');
}
