import React, { useState, useEffect, useRef } from 'react'
import { User, Fingerprint, Briefcase, MapPinned, RotateCcw, UserPlus, Loader2 } from 'lucide-react'
import { workerService } from '../services/workerService'
import fingerprintService from '../services/fingerprintService'
import { useToast } from '../components/Toast'
import ClassificationField, {
  type ClassificationFieldHandle,
} from '../components/ClassificationField'

interface WorkerFormData {
  workerNumber: string
  fullName: string
  nid: string
  fingerprintId: string
  classification: string
  phoneNumber: string
  hourlyRate: string
  address: string
  emergencyContact: string
  emergencyPhone: string
}

const WorkerRegistration: React.FC = () => {
  const toast = useToast()
  const [formData, setFormData] = useState<WorkerFormData>({
    workerNumber: '',
    fullName: '',
    nid: '',
    fingerprintId: '',
    classification: 'LABORER',
    phoneNumber: '',
    hourlyRate: '',
    address: '',
    emergencyContact: '',
    emergencyPhone: '',
  })
  const [loading, setLoading] = useState(false)
  const [fingerprintScanning, setFingerprintScanning] = useState(false)
  const [fingerprintStep, setFingerprintStep] = useState<string | null>(null)
  const classificationRef = useRef<ClassificationFieldHandle>(null)

  useEffect(() => {
    loadNextWorkerNumber()
  }, [])

  const loadNextWorkerNumber = async () => {
    try {
      const nextNum = await workerService.getNextWorkerNumber()
      setFormData(prev => ({ ...prev, workerNumber: nextNum }))
    } catch (err) {
      console.error('Failed to load next worker number:', err)
    }
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleFingerprintScan = async () => {
    try {
      setFingerprintScanning(true)
      setFingerprintStep('Place the same finger on the scanner (1 of 3)…')
      const { template } = await fingerprintService.captureForEnrollment((step, total) => {
        if (step === 1) {
          setFingerprintStep(`Place your finger on the scanner (${step} of ${total})…`)
        } else {
          setFingerprintStep(
            `Lift your finger, then place the same finger again (${step} of ${total})…`
          )
        }
      })
      setFormData(prev => ({ ...prev, fingerprintId: template }))
      setFingerprintStep(null)
      toast.success('Fingerprint enrolled successfully')
    } catch (err: any) {
      setFingerprintStep(null)
      toast.error(err?.message || 'Fingerprint capture failed')
    } finally {
      setFingerprintScanning(false)
    }
  }

  const validateForm = (): string | null => {
    if (!formData.workerNumber.trim()) return 'Worker number is required'
    if (!formData.fullName.trim()) return 'Full name is required'
    if (!formData.nid.trim()) return 'NID is required'
    if (!formData.fingerprintId.trim()) return 'Fingerprint is required'
    if (!formData.hourlyRate.trim()) return 'Hourly rate is required'
    if (!/^\d{16}$/.test(formData.nid)) return 'NID must be exactly 16 digits'
    if (formData.phoneNumber && !/^(078|079|072|073)\d{7}$/.test(formData.phoneNumber)) {
      return 'Phone must be a valid Rwandan number (e.g. 0788123456)'
    }
    if (formData.emergencyPhone && !/^(078|079|072|073)\d{7}$/.test(formData.emergencyPhone)) {
      return 'Emergency phone must be a valid Rwandan number'
    }
    const rate = parseFloat(formData.hourlyRate)
    if (isNaN(rate) || rate <= 0) return 'Hourly rate must be a positive number'
    return null
  }

  const resetForm = () => {
    setFormData({
      workerNumber: '',
      fullName: '',
      nid: '',
      fingerprintId: '',
      classification: 'LABORER',
      phoneNumber: '',
      hourlyRate: '',
      address: '',
      emergencyContact: '',
      emergencyPhone: '',
    })
    loadNextWorkerNumber()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    let classification = formData.classification
    if (classification === 'OTHER') {
      const committed = await classificationRef.current?.commitPending()
      if (!committed) {
        toast.error('Enter a name for the new classification')
        return
      }
      classification = committed
    }

    const validationError = validateForm()
    if (validationError) {
      toast.error(validationError)
      return
    }

    try {
      setLoading(true)
      await workerService.registerWorker({
        workerNumber: formData.workerNumber.trim(),
        fullName: formData.fullName.trim(),
        nid: formData.nid.trim(),
        fingerprintId: formData.fingerprintId.trim(),
        classification,
        phoneNumber: formData.phoneNumber.trim() || undefined,
        hourlyRate: parseFloat(formData.hourlyRate),
        address: formData.address.trim() || undefined,
        emergencyContact: formData.emergencyContact.trim() || undefined,
        emergencyPhone: formData.emergencyPhone.trim() || undefined,
      })

      toast.success(`${formData.fullName} registered successfully`)
      setTimeout(resetForm, 2000)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to register worker')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="worker-registration">
      <form className="registration-form" onSubmit={handleSubmit}>
        <div className="form-sections">
          <section className="form-section">
            <h3 className="section-title">
              <span className="section-title__icon">
                <User size={16} />
              </span>
              Basic information
            </h3>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="workerNumber">
                  Worker number <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="workerNumber"
                  name="workerNumber"
                  value={formData.workerNumber}
                  placeholder="Auto-generating…"
                  required
                  readOnly
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="fullName">
                  Full name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder="e.g. Jean Mugabo"
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="nid">
                  National ID (NID) <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="nid"
                  name="nid"
                  value={formData.nid}
                  onChange={handleInputChange}
                  placeholder="16 digits"
                  maxLength={16}
                  required
                  disabled={loading}
                />
                <span className="field-hint">Must be exactly 16 digits</span>
              </div>
              <div className="form-group">
                <label htmlFor="phoneNumber">Phone number</label>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  placeholder="0788123456"
                  maxLength={10}
                  disabled={loading}
                />
                <span className="field-hint">Rwandan format: 078 / 079 / 072 / 073</span>
              </div>
            </div>
          </section>

          <section className="form-section">
            <h3 className="section-title">
              <span className="section-title__icon">
                <Fingerprint size={16} />
              </span>
              Biometric enrollment
            </h3>
            <div className="fingerprint-capture form-group">
              <label>
                Fingerprint template <span className="required">*</span>
              </label>
              <div className="fingerprint-control">
                <input
                  type="text"
                  name="fingerprintId"
                  value={formData.fingerprintId}
                  placeholder="Scan on Live20R to capture"
                  required
                  disabled={loading}
                  readOnly
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleFingerprintScan}
                  disabled={loading || fingerprintScanning}
                >
                  {fingerprintScanning ? <Loader2 className="spin" size={18} /> : <Fingerprint size={18} />}
                  {fingerprintScanning ? 'Scanning…' : 'Scan fingerprint'}
                </button>
              </div>
              <span className="field-hint">
                {fingerprintStep ||
                  'Click Scan, then place and fully lift the same finger three times'}
              </span>
            </div>
          </section>

          <section className="form-section">
            <h3 className="section-title">
              <span className="section-title__icon">
                <Briefcase size={16} />
              </span>
              Work information
            </h3>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="classification">
                  Classification <span className="required">*</span>
                </label>
                <ClassificationField
                  ref={classificationRef}
                  id="classification"
                  name="classification"
                  value={formData.classification}
                  required
                  disabled={loading}
                  onChange={classification =>
                    setFormData(prev => ({ ...prev, classification }))
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="hourlyRate">
                  Hourly rate (RWF) <span className="required">*</span>
                </label>
                <input
                  type="number"
                  id="hourlyRate"
                  name="hourlyRate"
                  value={formData.hourlyRate}
                  onChange={handleInputChange}
                  placeholder="2500"
                  min="0"
                  step="100"
                  required
                  disabled={loading}
                />
              </div>
            </div>
          </section>

          <section className="form-section">
            <h3 className="section-title">
              <span className="section-title__icon">
                <MapPinned size={16} />
              </span>
              Additional details
            </h3>
            <div className="form-grid">
              <div className="form-group form-group-full">
                <label htmlFor="address">Address</label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Residential address"
                  rows={2}
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="emergencyContact">Emergency contact</label>
                <input
                  type="text"
                  id="emergencyContact"
                  name="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={handleInputChange}
                  placeholder="Contact person"
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="emergencyPhone">Emergency phone</label>
                <input
                  type="tel"
                  id="emergencyPhone"
                  name="emergencyPhone"
                  value={formData.emergencyPhone}
                  onChange={handleInputChange}
                  placeholder="0788123456"
                  maxLength={10}
                  disabled={loading}
                />
              </div>
            </div>
          </section>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={resetForm} disabled={loading}>
            <RotateCcw size={16} />
            Reset
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <Loader2 className="spin" size={18} /> : <UserPlus size={18} />}
            {loading ? 'Registering…' : 'Register worker'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default WorkerRegistration
