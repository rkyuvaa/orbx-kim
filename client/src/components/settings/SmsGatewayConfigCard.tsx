import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
  Chip,
  Divider,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MessageSquare, Send, ShieldCheck, Zap } from 'lucide-react';

import {
  useGetSmsSettingsQuery,
  useTestSmsConnectionMutation,
  useUpdateSmsSettingsMutation,
} from '@/api/smsApi';
import { useToast } from '@/components/ui/ToastHost';

const smsSchema = z.object({
  provider: z.string().min(1, 'Provider is required'),
  api_url: z.string().url('Invalid API URL').or(z.literal('')),
  api_method: z.enum(['GET', 'POST']),
  username: z.string().optional().or(z.literal('')),
  password: z.string().optional().or(z.literal('')),
  sender_id: z.string().optional().or(z.literal('')),
  entity_id: z.string().optional().or(z.literal('')),
  registration_template_id: z.string().optional().or(z.literal('')),
  registration_message_template: z.string().optional().or(z.literal('')),
  otp_template_id: z.string().optional().or(z.literal('')),
  otp_message_template: z.string().optional().or(z.literal('')),
  is_enabled: z.boolean(),
});

type SmsFormValues = z.infer<typeof smsSchema>;

const DEFAULT_REGISTRATION_TEMPLATE =
  'Dear Customer, your vehicle service complaint has been registered successfully. Service ID: {#alphanumeric#} Date: {#alphanumeric#} Our support team will contact you shortly. KIM EV Service: Your service request {complaint_no} for vehicle {vehicle_number} has been registered. Our technician will contact you shortly.';

const DEFAULT_OTP_TEMPLATE =
  'Dear Customer, Your vehicle service has been completed successfully. Service ID: {#alphanumeric#} OTP: {#numeric#} Please share this OTP with our technician to confirm service completion. Thank you, Konwert India Motors.';

export default function SmsGatewayConfigCard() {
  const { showToast } = useToast();
  const { data: sms, isLoading } = useGetSmsSettingsQuery();
  const [updateSms, { isLoading: isSaving }] = useUpdateSmsSettingsMutation();
  const [testSms, { isLoading: isTesting }] = useTestSmsConnectionMutation();

  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testPhoneInput, setTestPhoneInput] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SmsFormValues>({
    resolver: zodResolver(smsSchema),
    defaultValues: {
      provider: 'textguru',
      api_url: 'https://www.textguru.in/api/v2/SendSMS.aspx',
      api_method: 'GET',
      username: '',
      password: '',
      sender_id: 'KIMEV',
      entity_id: '',
      registration_template_id: '',
      registration_message_template: DEFAULT_REGISTRATION_TEMPLATE,
      otp_template_id: '',
      otp_message_template: DEFAULT_OTP_TEMPLATE,
      is_enabled: true,
    },
  });

  const isEnabled = watch('is_enabled');
  const providerVal = watch('provider');
  const apiMethodVal = watch('api_method');

  useEffect(() => {
    if (sms) {
      reset({
        provider: sms.provider || 'textguru',
        api_url: sms.api_url || 'https://www.textguru.in/api/v2/SendSMS.aspx',
        api_method: sms.api_method || 'GET',
        username: sms.username || '',
        password: '',
        sender_id: sms.sender_id || 'KIMEV',
        entity_id: sms.entity_id || '',
        registration_template_id: sms.registration_template_id || '',
        registration_message_template: sms.registration_message_template || DEFAULT_REGISTRATION_TEMPLATE,
        otp_template_id: sms.otp_template_id || '',
        otp_message_template: sms.otp_message_template || DEFAULT_OTP_TEMPLATE,
        is_enabled: sms.is_enabled,
      });
    }
  }, [sms, reset]);

  const onSave = async (data: SmsFormValues) => {
    try {
      await updateSms(data).unwrap();
      showToast('SMS Gateway settings updated successfully', 'success');
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to update SMS settings', 'error');
    }
  };

  const handleRunTest = async () => {
    if (!testPhoneInput || testPhoneInput.trim().length < 10) {
      showToast('Please enter a valid 10-digit mobile number', 'error');
      return;
    }
    setTestResult(null);
    try {
      const res = await testSms({
        test_phone: testPhoneInput.trim(),
        provider: watch('provider'),
        api_url: watch('api_url'),
        api_method: watch('api_method'),
        username: watch('username'),
        password: watch('password'),
        sender_id: watch('sender_id'),
        entity_id: watch('entity_id'),
      }).unwrap();
      setTestResult({ success: true, message: res.message });
      showToast(res.message, 'success');
    } catch (err: any) {
      const detail = err?.data?.detail || 'SMS Test Failed';
      setTestResult({ success: false, message: typeof detail === 'string' ? detail : 'Test failed' });
      showToast('SMS Gateway Test Failed', 'error');
    }
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        <div>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <MessageSquare size={20} color="#16C47F" />
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#023020' }}>
              SMS Gateway Configuration (TextGuru)
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: '#7A8B80', mt: 0.5 }}>
            Configure your 3rd-party SMS gateway for customer complaint registration confirmations and closure verification OTPs.
          </Typography>
        </div>

        <FormControlLabel
          control={
            <Switch
              checked={isEnabled}
              onChange={(e) => setValue('is_enabled', e.target.checked)}
              color="success"
            />
          }
          label={
            <span style={{ fontWeight: 700, fontSize: 13, color: isEnabled ? '#16C47F' : '#7A8B80' }}>
              {isEnabled ? 'SMS Service Enabled' : 'Service Disabled'}
            </span>
          }
        />
      </Box>

      {/* Preset Quick Chips */}
      <Box sx={{ mb: 2.5, p: 2, backgroundColor: '#F8FAF7', borderRadius: '10px', border: '1px solid #E4EBE1' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Zap size={14} color="#16C47F" />
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#023020', textTransform: 'uppercase' }}>
            Gateway Provider
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip
            label="TextGuru (India DLT Gateway)"
            onClick={() => {
              setValue('provider', 'textguru');
              setValue('api_url', 'https://www.textguru.in/api/v2/SendSMS.aspx');
              setValue('api_method', 'GET');
            }}
            sx={{
              fontWeight: 700,
              fontSize: 11.5,
              cursor: 'pointer',
              backgroundColor: providerVal === 'textguru' ? '#E8F5E9' : '#FFFFFF',
              borderColor: providerVal === 'textguru' ? '#16C47F' : '#D6E4D9',
              borderWidth: 1,
              borderStyle: 'solid',
            }}
          />
          <Chip
            label="Generic HTTP Gateway"
            onClick={() => {
              setValue('provider', 'generic_http');
            }}
            sx={{
              fontWeight: 700,
              fontSize: 11.5,
              cursor: 'pointer',
              backgroundColor: providerVal === 'generic_http' ? '#E8F5E9' : '#FFFFFF',
              borderColor: providerVal === 'generic_http' ? '#16C47F' : '#D6E4D9',
              borderWidth: 1,
              borderStyle: 'solid',
            }}
          />
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 2.5, borderRadius: '10px', '& .MuiAlert-message': { fontSize: 13, lineHeight: 1.5 } }}>
        <strong>DLT Compliance (Telecom India):</strong> Ensure your SMS Sender ID, Entity ID (PEID), and Template IDs match the approved records in your telecom DLT portal (Jio, Airtel, Vodafone, PingConnect). TextGuru automatically validates DLT parameters upon dispatch.
      </Alert>

      <form onSubmit={handleSubmit(onSave)}>
        {/* Connection Credentials */}
        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#023020', mb: 1 }}>
          API Credentials & Gateway Endpoint
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: 2, mb: 2 }}>
          <TextField
            fullWidth
            label="Gateway API URL"
            placeholder="https://www.textguru.in/api/v2/SendSMS.aspx"
            margin="dense"
            error={Boolean(errors.api_url)}
            helperText={errors.api_url?.message}
            {...register('api_url')}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel id="sms-method-label">HTTP Method</InputLabel>
            <Select
              labelId="sms-method-label"
              label="HTTP Method"
              value={apiMethodVal}
              onChange={(e) => setValue('api_method', e.target.value as 'GET' | 'POST')}
            >
              <MenuItem value="GET">GET (Standard Query Params)</MenuItem>
              <MenuItem value="POST">POST (Form Data)</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
          <TextField
            fullWidth
            label="Username / User ID"
            placeholder="e.g. textguru_user"
            margin="dense"
            error={Boolean(errors.username)}
            helperText={errors.username?.message}
            {...register('username')}
          />
          <TextField
            fullWidth
            label="Password / API Key"
            type="password"
            placeholder={sms?.has_password ? '•••••••• (Leave blank to keep existing)' : 'Enter TextGuru password'}
            margin="dense"
            error={Boolean(errors.password)}
            helperText={errors.password?.message || (sms?.has_password ? 'Password configured in system' : '')}
            {...register('password')}
          />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 3 }}>
          <TextField
            fullWidth
            label="Sender ID (Header)"
            placeholder="e.g. KIMEV or KONWRT (6 characters)"
            margin="dense"
            error={Boolean(errors.sender_id)}
            helperText={errors.sender_id?.message || 'Approved 6-character DLT Sender ID'}
            {...register('sender_id')}
          />
          <TextField
            fullWidth
            label="Principal Entity ID (PEID)"
            placeholder="e.g. 1201159123456789012 (19 digits)"
            margin="dense"
            error={Boolean(errors.entity_id)}
            helperText={errors.entity_id?.message || 'DLT Principal Entity ID'}
            {...register('entity_id')}
          />
        </Box>

        <Divider sx={{ my: 2.5 }} />

        {/* Message Templates */}
        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#023020', mb: 1 }}>
          Message Templates & DLT Template IDs
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' }, gap: 2, mb: 1 }}>
            <TextField
              fullWidth
              label="Registration DLT Template ID"
              placeholder="e.g. 1207161234567890123"
              margin="dense"
              error={Boolean(errors.registration_template_id)}
              helperText={errors.registration_template_id?.message}
              {...register('registration_template_id')}
            />
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: '#64748B' }}>
                Tokens: <code>{'{complaint_no}'}</code>, <code>{'{vehicle_number}'}</code>, <code>{'{date}'}</code> or DLT <code>{'#{alphanumeric}#'}</code>
              </Typography>
            </Box>
          </Box>
          <TextField
            fullWidth
            multiline
            rows={2}
            label="Complaint Registration Confirmation Message"
            placeholder={DEFAULT_REGISTRATION_TEMPLATE}
            margin="dense"
            error={Boolean(errors.registration_message_template)}
            helperText={errors.registration_message_template?.message}
            {...register('registration_message_template')}
          />
        </Box>

        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' }, gap: 2, mb: 1 }}>
            <TextField
              fullWidth
              label="Closure OTP DLT Template ID"
              placeholder="e.g. 1207161234567890124"
              margin="dense"
              error={Boolean(errors.otp_template_id)}
              helperText={errors.otp_template_id?.message}
              {...register('otp_template_id')}
            />
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: '#64748B' }}>
                Tokens: <code>{'{complaint_no}'}</code>, <code>{'{otp_code}'}</code> or DLT <code>{'#{alphanumeric}#'}</code>, <code>{'#{numeric}#'}</code>
              </Typography>
            </Box>
          </Box>
          <TextField
            fullWidth
            multiline
            rows={2}
            label="Complaint Closure OTP Message"
            placeholder={DEFAULT_OTP_TEMPLATE}
            margin="dense"
            error={Boolean(errors.otp_message_template)}
            helperText={errors.otp_message_template?.message}
            {...register('otp_message_template')}
          />
        </Box>

        {/* Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 3 }}>
          <Button
            type="button"
            variant="outlined"
            onClick={() => {
              setTestDialogOpen(true);
              setTestResult(null);
            }}
            startIcon={<Send size={15} />}
            sx={{
              borderColor: '#023020',
              color: '#023020',
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: '8px',
              '&:hover': { borderColor: '#034732', backgroundColor: '#F0FDF4' },
            }}
          >
            Send Test SMS
          </Button>

          <Button
            type="submit"
            variant="contained"
            disabled={isSaving}
            startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <ShieldCheck size={16} />}
            sx={{
              backgroundColor: '#023020',
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: '8px',
              '&:hover': { backgroundColor: '#034732' },
            }}
          >
            {isSaving ? 'Saving...' : 'Save SMS Configuration'}
          </Button>
        </Box>
      </form>

      {/* Test SMS Dialog */}
      <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#023020', pb: 1 }}>
          Test SMS Gateway Connection
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>
            Enter a 10-digit Indian mobile number to dispatch a test verification SMS through the gateway.
          </Typography>

          <TextField
            fullWidth
            label="Recipient Mobile Number"
            placeholder="e.g. 9787317484"
            value={testPhoneInput}
            onChange={(e) => setTestPhoneInput(e.target.value)}
            margin="dense"
            disabled={isTesting}
          />

          {testResult && (
            <Alert
              severity={testResult.success ? 'success' : 'error'}
              sx={{ mt: 2, borderRadius: '8px', '& .MuiAlert-message': { fontSize: 13 } }}
            >
              {testResult.message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTestDialogOpen(false)} sx={{ textTransform: 'none', color: '#64748B' }}>
            Close
          </Button>
          <Button
            variant="contained"
            onClick={handleRunTest}
            disabled={isTesting}
            startIcon={isTesting ? <CircularProgress size={15} color="inherit" /> : <Send size={15} />}
            sx={{
              backgroundColor: '#023020',
              fontWeight: 700,
              textTransform: 'none',
              '&:hover': { backgroundColor: '#034732' },
            }}
          >
            {isTesting ? 'Sending...' : 'Dispatch Test'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
