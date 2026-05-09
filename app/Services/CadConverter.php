<?php

namespace App\Services;

use App\Models\UserFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;

/**
 * CadConverter — converts CAD files (DWG/DXF) to PDF for in-browser preview.
 *
 * Uses LibreOffice in headless mode. LibreOffice must be installed:
 * - Windows: download from libreoffice.org, typically installs to C:\Program Files\LibreOffice\
 * - Linux:   sudo apt install libreoffice
 * - macOS:   brew install --cask libreoffice
 *
 * Configuration: set LIBREOFFICE_PATH in .env if auto-detection fails.
 */
class CadConverter
{
    /**
     * Auto-detect LibreOffice binary path across platforms.
     */
    public function detectLibreOfficePath(): ?string
    {
        // Explicit config wins
        if ($configured = env('LIBREOFFICE_PATH')) {
            if (file_exists($configured)) return $configured;
        }

        $candidates = PHP_OS_FAMILY === 'Windows'
            ? [
                'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
                'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
                'C:\\Program Files\\LibreOffice 7\\program\\soffice.exe',
                'C:\\Program Files\\LibreOffice 24\\program\\soffice.exe',
            ]
            : [
                '/usr/bin/libreoffice',
                '/usr/bin/soffice',
                '/usr/local/bin/libreoffice',
                '/usr/local/bin/soffice',
                '/opt/libreoffice/program/soffice',
                '/Applications/LibreOffice.app/Contents/MacOS/soffice',
            ];

        foreach ($candidates as $path) {
            if (file_exists($path)) return $path;
        }

        return null;
    }

    public function isAvailable(): bool
    {
        return $this->detectLibreOfficePath() !== null;
    }

    /**
     * Generate a PDF preview for a UserFile (DWG or DXF).
     * Returns the UserFile updated with preview_path set, or null on failure.
     */
    public function generatePreview(UserFile $file): ?UserFile
    {
        $extension = strtolower($file->extension);
        if (!in_array($extension, ['dwg', 'dxf'])) {
            return null; // Not a CAD file
        }

        $binary = $this->detectLibreOfficePath();
        if (!$binary) {
            $file->update([
                'preview_status' => 'failed',
                'preview_error'  => 'LibreOffice is not installed on the server. Install it or set LIBREOFFICE_PATH in .env',
            ]);
            return $file;
        }

        $file->update(['preview_status' => 'pending', 'preview_error' => null]);

        try {
            $sourcePath = Storage::disk('public')->path($file->stored_path);
            if (!file_exists($sourcePath)) {
                throw new \RuntimeException('Source file not found on disk.');
            }

            // Use a dedicated temp working directory
            $workDir = storage_path('app/cad-convert/' . uniqid());
            if (!is_dir($workDir)) {
                mkdir($workDir, 0755, true);
            }

            // LibreOffice creates the PDF with the same basename + .pdf
            $process = new Process([
                $binary,
                '--headless',
                '--convert-to', 'pdf',
                '--outdir', $workDir,
                $sourcePath,
            ]);
            $process->setTimeout(120); // 2 minutes
            $process->run();

            if (!$process->isSuccessful()) {
                throw new \RuntimeException('LibreOffice conversion failed: ' . $process->getErrorOutput());
            }

            $baseName = pathinfo($file->original_name, PATHINFO_FILENAME);
            $generatedPdf = $workDir . DIRECTORY_SEPARATOR . $baseName . '.pdf';

            if (!file_exists($generatedPdf)) {
                throw new \RuntimeException('Conversion completed but output PDF not found.');
            }

            // Move PDF into public storage under cad-previews/
            $previewFilename = 'preview_' . $file->id . '_' . time() . '.pdf';
            $previewRelPath = 'cad-previews/' . $previewFilename;
            Storage::disk('public')->makeDirectory('cad-previews');
            Storage::disk('public')->put($previewRelPath, file_get_contents($generatedPdf));

            // Cleanup temp
            @unlink($generatedPdf);
            @rmdir($workDir);

            // Delete any previous preview
            if ($file->preview_path) {
                Storage::disk('public')->delete($file->preview_path);
            }

            $file->update([
                'preview_path'         => $previewRelPath,
                'preview_mime'         => 'application/pdf',
                'preview_generated_at' => now(),
                'preview_status'       => 'ready',
                'preview_error'        => null,
            ]);

            return $file;
        } catch (\Throwable $e) {
            Log::warning('CAD conversion failed', ['file_id' => $file->id, 'error' => $e->getMessage()]);
            $file->update([
                'preview_status' => 'failed',
                'preview_error'  => $e->getMessage(),
            ]);
            return $file;
        }
    }
}
