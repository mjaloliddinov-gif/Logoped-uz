'use client';
import {localize} from '../lib/i18n';
import {useLocale} from './Preferences';
export function Media({ file }: any) { useLocale(); if (!file?.data?.key)
    return null; const url = '/api/files?id=' + encodeURIComponent(file.id) + '&inline=1', mime = file.data.mime; return <div className="material-preview">{mime.startsWith('audio/') ? <audio controls src={url} aria-label={localize(file.data.name)}/> : mime.startsWith('video/') ? <video controls preload="metadata" src={url} aria-label={localize(file.data.name)}/> : mime.startsWith('image/') ? <img src={url} alt={localize(file.data.body || file.data.name)}/> : mime === 'application/pdf' ? <iframe title={localize(file.data.name)} src={url}/> : null}</div>; }
