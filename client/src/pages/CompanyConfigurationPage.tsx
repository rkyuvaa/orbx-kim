import { useEffect, useState, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
  Chip,
  Avatar,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building2,
  Save,
  Image,
  Edit,
  Delete,
  Upload,
  CheckCircle,
  AlertCircle,
  Info,
  MapPin,
  Phone,
  Mail,
  FileText,
  Globe,
  CreditCard,
} from 'lucide-react';

import { useGetAppDataQuery, usePutAppDataMutation } from '@/api/appDataApi';
import { useToast } from '@/components/ui/ToastHost';

const companyConfigSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  legal_name: z.string().optional(),
  tagline: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  cin: z.string().optional(),
  bank_name: z.string().optional(),
  bank_account_number: z.string().optional(),
  bank_ifsc: z.string().optional(),
  bank_branch: z.string().optional(),
  logo_base64: z.string().optional(),
  logo_mime_type: z.string().optional(),
});

type CompanyConfigFormValues = z.infer<typeof companyConfigSchema>;

const DEFAULT_COMPANY_CONFIG: CompanyConfigFormValues = {
  company_name: '',
  legal_name: '',
  tagline: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
  phone: '',
  email: '',
  website: '',
  gstin: '',
  pan: '',
  cin: '',
  bank_name: '',
  bank_account_number: '',
  bank_ifsc: '',
  bank_branch: '',
  logo_base64: '',
  logo_mime_type: '',
};

const COMPANY_CONFIG_KEY = 'company_configuration';

export default function CompanyConfigurationPage() {
  const { showToast } = useToast();
  const { data: appData, isLoading } = useGetAppDataQuery(COMPANY_CONFIG_KEY);
  const [putAppData, { isLoading: isSaving }] = usePutAppDataMutation();

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoDialogOpen, setLogoDialogOpen] = useState(false);
  const [cropperDialogOpen, setCropperDialogOpen] = useState(false);
  const [cropperImage, setCropperImage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CompanyConfigFormValues>({
    resolver: zodResolver(companyConfigSchema),
    defaultValues: DEFAULT_COMPANY_CONFIG,
  });

  // Load data from API
  useEffect(() => {
    if (appData?.value && !isLoading) {
      const config = appData.value as CompanyConfigFormValues;
      reset(config);
      if (config.logo_base64) {
        setLogoPreview(`data:${config.logo_mime_type || 'image/png'};base64,${config.logo_base64}`);
      }
    }
  }, [appData, isLoading, reset]);

  // Auto-set logo preview when logo_base64 changes
  const logoBase64 = watch('logo_base64');
  const logoMimeType = watch('logo_mime_type');
  useEffect(() => {
    if (logoBase64 && logoMimeType) {
      setLogoPreview(`data:${logoMimeType};base64,${logoBase64}`);
    } else if (!logoBase64) {
      setLogoPreview(null);
    }
  }, [logoBase64, logoMimeType]);

  const onSave = async (values: CompanyConfigFormValues) => {
    try {
      const payload = { ...values };
      // Remove empty strings for optional fields
      Object.keys(payload).forEach(key => {
        if (payload[key as keyof CompanyConfigFormValues] === '') {
          (payload as any)[key] = null;
        }
      });

      await putAppData({
        key: COMPANY_CONFIG_KEY,
        value: payload,
        expected_revision: appData?.revision || 0,
      }).unwrap();

      showToast('Company configuration saved successfully', 'success');
    } catch (err: any) {
      if (err?.status === 409) {
        showToast('Configuration was modified by another user. Please refresh and try again.', 'error');
      } else {
        const detail = err?.data?.detail || 'Failed to save company configuration';
        showToast(typeof detail === 'string' ? detail : 'Failed to save configuration', 'error');
      }
    }
  };

  const handleLogoUpload = (file: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      showToast('Please upload a valid image file (JPEG, PNG, WebP, or SVG)', 'error');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image size must be less than 2MB', 'error');
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setCropperImage(result);
      setCropperDialogOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleLogoCropped = (croppedBase64: string) => {
    const mimeType = croppedBase64.split(';')[0].split(':')[1] || 'image/png';
    setValue('logo_base64', croppedBase64.split(',')[1]);
    setValue('logo_mime_type', mimeType);
    setLogoPreview(croppedBase64);
    setCropperDialogOpen(false);
    setCropperImage(null);
    setLogoFile(null);
  };

  const handleRemoveLogo = () => {
    setValue('logo_base64', '');
    setValue('logo_mime_type', '');
    setLogoPreview(null);
    showToast('Logo removed', 'info');
  };

  if (isLoading) {
    return (
      <Paper sx={{ border: '1px solid #E4EBE1', borderRadius: '14px', p: 4, textAlign: 'center' }}>
        <CircularProgress color="success" size={28} />
      </Paper>
    );
  }

  return (
    <Paper sx={{ border: '1px solid #E4EBE1', borderRadius: '14px', p: 3, background: '#FFFFFF' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
        <div>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Building2 size={20} color="#16C47F" />
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#023020' }}>
              Company Configuration
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: '#7A8B80', mt: 0.5 }}>
            Configure your company details and logo. This information will appear on all printouts and documents.
          </Typography>
        </div>
      </Box>

      <form onSubmit={handleSubmit(onSave)}>
        {/* Logo Section */}
        <Box sx={{ mb: 3, p: 2, backgroundColor: '#F8FAF7', borderRadius: '10px', border: '1px solid #E4EBE1' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Image size={16} color="#16C47F" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#023020' }}>
              Company Logo
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
            <Box sx={{ position: 'relative' }}>
              {logoPreview ? (
                <Avatar
                  src={logoPreview}
                  alt="Company Logo"
                  sx={{ width: 80, height: 80, border: '2px solid #E4EBE1', backgroundColor: '#FFFFFF' }}
                />
              ) : (
                <Avatar
                  sx={{ width: 80, height: 80, border: '2px dashed #D6E4D9', backgroundColor: '#F8FAF7', color: '#7A8B80' }}
                >
                  <Image size={32} />
                </Avatar>
              )}
              {logoPreview && (
                <IconButton
                  size="small"
                  onClick={handleRemoveLogo}
                  sx={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    bgcolor: 'error.main',
                    color: 'white',
                    '&:hover': { bgcolor: 'error.dark' },
                    boxShadow: 2,
                  }}
                  aria-label="Remove logo"
                >
                  <Delete size={16} />
                </IconButton>
              )}
            </Box>

            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<Upload size={16} />}
                sx={{
                  borderColor: '#16C47F',
                  color: '#16C47F',
                  '&:hover': { borderColor: '#023020', backgroundColor: '#EAF6E8' },
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: '8px',
                }}
              >
                {logoPreview ? 'Change Logo' : 'Upload Logo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  hidden
                  onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                />
              </Button>
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#7A8B80' }}>
                Recommended: 200x200px, max 2MB (JPEG, PNG, WebP, SVG)
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Company Basic Info */}
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#023020', mb: 2, pb: 1, borderBottom: '2px solid #E4EBE1' }}>
          Basic Information
        </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Company Name *"
              placeholder="e.g. Konwert India Motors Pvt Ltd"
              margin="dense"
              error={Boolean(errors.company_name)}
              helperText={errors.company_name?.message}
              {...register('company_name')}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Legal Name"
              placeholder="Full legal name as per registration"
              margin="dense"
              {...register('legal_name')}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Tagline / Slogan"
              placeholder="e.g. Driving Excellence Since 2000"
              margin="dense"
              {...register('tagline')}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Country"
              placeholder="India"
              margin="dense"
              {...register('country')}
            />
          </Grid>
        </Grid>

        {/* Address */}
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#023020', mb: 2, pb: 1, borderBottom: '2px solid #E4EBE1' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MapPin size={18} color="#16C47F" />
            Address
          </Box>
        </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Address Line 1"
              placeholder="Building/Street name"
              margin="dense"
              {...register('address_line1')}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Address Line 2"
              placeholder="Area/Locality"
              margin="dense"
              {...register('address_line2')}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="City"
              placeholder="e.g. Chennai"
              margin="dense"
              {...register('city')}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="State"
              placeholder="e.g. Tamil Nadu"
              margin="dense"
              {...register('state')}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="PIN Code"
              placeholder="e.g. 600001"
              margin="dense"
              {...register('pincode')}
            />
          </Grid>
        </Grid>

        {/* Contact Info */}
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#023020', mb: 2, pb: 1, borderBottom: '2px solid #E4EBE1' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Phone size={18} color="#16C47F" />
            Contact Information
          </Box>
        </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Phone Number"
              placeholder="+91 XXXXXXXXXX"
              margin="dense"
              {...register('phone')}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Email Address"
              placeholder="info@company.com"
              margin="dense"
              error={Boolean(errors.email)}
              helperText={errors.email?.message}
              {...register('email')}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Website"
              placeholder="https://www.company.com"
              margin="dense"
              error={Boolean(errors.website)}
              helperText={errors.website?.message}
              {...register('website')}
            />
          </Grid>
        </Grid>

        {/* Statutory Registrations */}
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#023020', mb: 2, pb: 1, borderBottom: '2px solid #E4EBE1' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FileText size={18} color="#16C47F" />
            Statutory Registrations
          </Box>
        </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="GSTIN"
              placeholder="e.g. 33AAAAA0000A1Z5"
              margin="dense"
              {...register('gstin')}
              inputProps={{ maxLength: 15 }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="PAN"
              placeholder="e.g. AAAAA0000A"
              margin="dense"
              {...register('pan')}
              inputProps={{ maxLength: 10 }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="CIN"
              placeholder="e.g. U12345TN2000PTC012345"
              margin="dense"
              {...register('cin')}
              inputProps={{ maxLength: 21 }}
            />
          </Grid>
        </Grid>

        {/* Bank Details */}
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#023020', mb: 2, pb: 1, borderBottom: '2px solid #E4EBE1' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CreditCard size={18} color="#16C47F" />
            Bank Details (for payment references on documents)
          </Box>
        </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Bank Name"
              placeholder="e.g. HDFC Bank"
              margin="dense"
              {...register('bank_name')}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Account Number"
              placeholder="e.g. 50200012345678"
              margin="dense"
              {...register('bank_account_number')}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="IFSC Code"
              placeholder="e.g. HDFC0001234"
              margin="dense"
              {...register('bank_ifsc')}
              inputProps={{ maxLength: 11 }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Branch"
              placeholder="e.g. Chennai - T Nagar"
              margin="dense"
              {...register('bank_branch')}
            />
          </Grid>
        </Grid>

        {/* Preview Section */}
        <Alert severity="info" sx={{ mb: 3, borderRadius: '10px', '& .MuiAlert-message': { fontSize: 13, lineHeight: 1.5 } }}>
          <Info size={18} />
          <Box sx={{ ml: 1 }}>
            <strong>Print Preview:</strong> The company name, address, contact details, GSTIN, and logo configured here will appear in the header of all printed documents (Material Requirements, IT Requirements, etc.).
          </Box>
        </Alert>

        {/* Save Button */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            sx={{
              borderColor: '#7A8B80',
              color: '#7A8B80',
              '&:hover': { borderColor: '#023020', backgroundColor: '#F8FAF7' },
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: '8px',
            }}
            onClick={() => {
              reset(DEFAULT_COMPANY_CONFIG);
              setLogoPreview(null);
            }}
          >
            Reset to Defaults
          </Button>

          <Button
            type="submit"
            variant="contained"
            disabled={isSaving}
            startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <Save size={16} />}
            sx={{
              backgroundColor: '#023020',
              '&:hover': { backgroundColor: '#012015' },
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: '8px',
            }}
          >
            {isSaving ? 'Saving...' : 'Save Company Configuration'}
          </Button>
        </Box>
      </form>

      {/* Cropper Dialog */}
      <Dialog open={cropperDialogOpen} onClose={() => setCropperDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 800, color: '#023020' }}>
          <Image size={22} color="#16C47F" />
          Crop Logo
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            {cropperImage && (
              <ImageCropper
                src={cropperImage}
                onCrop={handleLogoCropped}
                aspectRatio={1}
                maxWidth={500}
              />
            )}
          </Box>
        </DialogContent>
      </Dialog>
    </Paper>
  );
}

// Simple Image Cropper Component (inline to avoid extra dependency)
function ImageCropper({ src, onCrop, aspectRatio = 1, maxWidth = 500 }: { src: string; onCrop: (base64: string) => void; aspectRatio?: number; maxWidth?: number }) {
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 200, height: 200 });
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current?.complete) {
      setImgSize({ width: imgRef.current.naturalWidth, height: imgRef.current.naturalHeight });
      // Default crop to center square
      const size = Math.min(imgRef.current.naturalWidth, imgRef.current.naturalHeight);
      setCrop({
        x: (imgRef.current.naturalWidth - size) / 2,
        y: (imgRef.current.naturalHeight - size) / 2,
        width: size,
        height: size,
      });
    }
  }, [src]);

  const handleCrop = () => {
    if (!canvasRef.current || !imgRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = crop;
    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(
      imgRef.current,
      crop.x, crop.y, width, height,
      0, 0, width, height
    );

    onCrop(canvas.toDataURL('image/png'));
  };

  return (
    <Box sx={{ position: 'relative', maxWidth, mx: 'auto' }}>
      <img
        ref={imgRef}
        src={src}
        style={{
          maxWidth: '100%',
          height: 'auto',
          display: 'block',
          cursor: 'crosshair',
        }}
        onLoad={(e) => {
          const img = e.target as HTMLImageElement;
          setImgSize({ width: img.naturalWidth, height: img.naturalHeight });
          const size = Math.min(img.naturalWidth, img.naturalHeight);
          setCrop({
            x: (img.naturalWidth - size) / 2,
            y: (img.naturalHeight - size) / 2,
            width: size,
            height: size,
          });
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: crop.y,
          left: crop.x,
          width: crop.width,
          height: crop.height,
          border: '2px solid #16C47F',
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}
      />
      <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'center' }}>
        <Button variant="outlined" onClick={handleCrop} startIcon={<CheckCircle size={16} />} sx={{ fontWeight: 700, textTransform: 'none', borderRadius: '8px' }}>
          Crop & Use
        </Button>
        <Button variant="outlined" onClick={() => onCrop('')} startIcon={<AlertCircle size={16} />} sx={{ fontWeight: 700, textTransform: 'none', borderRadius: '8px', color: 'error.main', borderColor: 'error.main' }}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
}

export { COMPANY_CONFIG_KEY, type CompanyConfigFormValues };