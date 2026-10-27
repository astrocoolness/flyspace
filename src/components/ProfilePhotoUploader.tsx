import { useRef, useState, type ChangeEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 10 * 1024 * 1024
type Props = {
  supabase: SupabaseClient
  userId: string
  profileId: string
  onUploaded: (publicUrl: string) => Promise<void> | void
}
export function ProfilePhotoUploader({ supabase, userId, profileId, onUploaded }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<File | null>(null)

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null); setSelected(null); setError('')
    if (!file) return
    if (!ALLOWED.has(file.type)) { setError('Choose a JPG, PNG or WebP photo.'); return }
    if (file.size > MAX_BYTES) { setError('Photo must be smaller than 10 MB.'); return }
    setSelected(file)
    setPreview(URL.createObjectURL(file))
  }

  async function upload() {
    if (!selected || busy) return
    if (!userId || !profileId) { setError('Sign in to upload photos.'); return }
    setBusy(true); setError('')
    try {
      const ext = selected.type === 'image/png' ? 'png' : selected.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `${userId}/${profileId}/${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('media').upload(path, selected, {
        contentType: selected.type, cacheControl: '3600', upsert: false
      })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('media').getPublicUrl(path)
      try {
        await onUploaded(data.publicUrl)
      } catch (saveError) {
        await supabase.storage.from('media').remove([path])
        throw saveError
      }
      setSelected(null)
      if (preview) URL.revokeObjectURL(preview)
      setPreview(null)
      if (input.current) input.current.value = ''
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed. Please try again.')
    } finally { setBusy(false) }
  }

  return <section aria-label="Upload profile photo">
    <label htmlFor="flyspace-photo-file">Choose a photo from your device</label>
    <input id="flyspace-photo-file" ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} disabled={busy} />
    {preview && <img src={preview} alt="Selected photo preview" style={{ maxWidth: 240, maxHeight: 240, objectFit: 'contain' }} />}
    {error && <p role="alert">{error}</p>}
    <button type="button" onClick={upload} disabled={!selected || busy}>{busy ? 'Uploading…' : 'Save selected photo'}</button>
  </section>
}
