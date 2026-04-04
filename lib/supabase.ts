import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function getScreenings(city?: string) {
  let query = supabase
    .from('screenings')
    .select('*')
    .order('date', { ascending: true })

  if (city) {
    query = query.eq('city', city)
  }

  const { data, error } = await query
  if (error) console.error('Error fetching screenings:', error)
  return data || []
}

export async function getCities() {
  const { data, error } = await supabase
    .from('cities')
    .select('*')
    .order('name', { ascending: true })

  if (error) console.error('Error fetching cities:', error)
  return data || []
}

export async function getScreeningsByDate(city: string, date: string) {
  const { data, error } = await supabase
    .from('screenings')
    .select('*')
    .eq('city', city)
    .eq('date', date)
    .order('time', { ascending: true })

  if (error) console.error('Error fetching screenings by date:', error)
  return data || []
}

export async function getFreeScreenings(city: string) {
  const { data, error } = await supabase
    .from('screenings')
    .select('*')
    .eq('city', city)
    .eq('is_free', true)
    .order('date', { ascending: true })

  if (error) console.error('Error fetching free screenings:', error)
  return data || []
}

export async function addCitySuggestion(
  cityName: string,
  suggestedByName: string,
  suggestedByEmail: string
) {
  const { data, error } = await supabase
    .from('city_suggestions')
    .insert([{
      city_name: cityName,
      suggested_by_name: suggestedByName,
      suggested_by_email: suggestedByEmail,
      status: 'pending'
    }])

  if (error) console.error('Error adding city suggestion:', error)
  return data
}
