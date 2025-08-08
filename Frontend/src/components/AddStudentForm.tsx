import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../services/api';
import Select from 'react-select';

// Interface for a Branch
interface Branch {
  id: number;
  name: string;
}

// Interface for a Seat
interface Seat {
  id: number;
  seatNumber: string;
}

// Interface for a Schedule/Shift
interface Schedule {
  id: number;
  title: string;
  description?: string | null;
  time: string;
  eventDate: string;
  fee: number;
}

// Interface for a Locker
interface Locker {
  id: number;
  lockerNumber: string;
  isAssigned: boolean;
}

// Interface for react-select options
interface ShiftOption {
  value: number;
  label: string;
  isDisabled: boolean;
}

// Interface for generic react-select options
interface SelectOption {
  value: number | null;
  label: string;
  isDisabled?: boolean;
}

// Interface for the form's state
interface FormData {
  name: string;
  registrationNumber?: string;
  fatherName?: string;
  aadharNumber?: string;
  email?: string;
  phone: string;
  address?: string;
  branchId: number | null;
  membershipStart: string;
  membershipEnd: string;
  seatId: number | null;
  shiftIds: number[];
  lockerId: number | null;
  lockerFee: string;
  totalFee: string;
  cash: string;
  online: string;
  securityMoney: string;
  remark?: string;
  image: File | null;
  imageUrl: string | null;
  aadhaarFront: File | null;
  aadhaarFrontUrl: string | null;
  aadhaarBack: File | null;
  aadhaarBackUrl: string | null;
  discount: string;
}

const AddStudentForm: React.FC = () => {
  const navigate = useNavigate();
  // State for form data
  const [formData, setFormData] = useState<FormData>({
    name: '',
    registrationNumber: '',
    fatherName: '',
    aadharNumber: '',
    email: '',
    phone: '',
    address: '',
    branchId: null,
    membershipStart: '',
    membershipEnd: '',
    seatId: null,
    shiftIds: [],
    lockerId: null,
    lockerFee: '0',
    totalFee: '0',
    cash: '',
    online: '',
    securityMoney: '',
    remark: '',
    image: null,
    imageUrl: null,
    aadhaarFront: null,
    aadhaarFrontUrl: null,
    aadhaarBack: null,
    aadhaarBackUrl: null,
    discount: '0',
  });

  // State for data fetched from API
  const [branches, setBranches] = useState<Branch[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [shifts, setShifts] = useState<Schedule[]>([]);
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [availableShifts, setAvailableShifts] = useState<Schedule[]>([]);

  // State for loading indicators and errors
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [loadingLockers, setLoadingLockers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Effect to fetch initial data (branches and all shifts) when component mounts
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [branchData, shiftsData] = await Promise.all([
          api.getBranches(),
          api.getSchedules(),
        ]);

        setBranches(branchData);
        
        const formattedSchedules = shiftsData.schedules.map((schedule: any) => ({
          ...schedule,
          fee: schedule.fee ?? 0,
        }));
        setShifts(formattedSchedules);
        setAvailableShifts(formattedSchedules);
        setError(null);
      } catch (error: any) {
        console.error('Failed to fetch initial data:', error);
        setError('You do not have permission to view branches or shifts. Contact an admin.');
        toast.error('Failed to load data. Check your permissions.');
      }
    };
    fetchInitialData();
  }, []);

  // Effect to fetch seats and lockers when a branch is selected
  useEffect(() => {
    const fetchBranchSpecificData = async () => {
      if (formData.branchId !== null) {
        setLoadingSeats(true);
        setLoadingLockers(true);
        try {
          const seatsPromise = api.getSeats({ branchId: formData.branchId });
          const lockersPromise = api.getLockers(formData.branchId);
          const [seatsResponse, lockersResponse] = await Promise.all([seatsPromise, lockersPromise]);
          
          setSeats(seatsResponse.seats);
          setLockers(lockersResponse.lockers);
          setError(null);
        } catch (error) {
          console.error('Failed to fetch branch data:', error);
          setError('Failed to load seats and lockers for this branch. Check permissions.');
          toast.error('Failed to load seats and lockers.');
        } finally {
          setLoadingSeats(false);
          setLoadingLockers(false);
        }
      } else {
        setSeats([]);
        setLockers([]);
      }
    };
    fetchBranchSpecificData();
  }, [formData.branchId]);

  // Effect to fetch available shifts for a selected seat
  useEffect(() => {
    const fetchAvailableShiftsForSeat = async () => {
      if (!formData.seatId) {
        setAvailableShifts(shifts);
        return;
      }
      setLoadingShifts(true);
      try {
        const response = await api.getAvailableShifts(formData.seatId);
        const availableShiftIds = response.availableShifts.map(s => s.id);
        const available = shifts.filter(s => availableShiftIds.includes(s.id));
        setAvailableShifts(available);
        setError(null);
      } catch (error) {
        console.error('Failed to fetch available shifts:', error);
        setError('Failed to load available shifts. Check your permissions.');
        toast.error('Failed to load shifts.');
      } finally {
        setLoadingShifts(false);
      }
    };
    fetchAvailableShiftsForSeat();
  }, [formData.seatId, shifts]);

  // Handle changes to standard input fields
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle changes to react-select dropdowns
  const handleSelectChange = (name: keyof FormData, option: any) => {
    if (name === 'branchId') {
      const value = option ? option.value : null;
      setFormData(prev => ({
        ...prev,
        branchId: value,
        seatId: null,
        shiftIds: [],
        lockerId: null,
        lockerFee: '0',
        totalFee: '0',
      }));
    } else if (name === 'seatId') {
      const value = option ? option.value : null;
      setFormData(prev => ({
        ...prev,
        seatId: value,
        shiftIds: [],
        totalFee: '0',
      }));
    } else if (name === 'lockerId') {
      const value = option ? option.value : null;
      setFormData(prev => ({
        ...prev,
        lockerId: value,
        // Reset locker fee when locker is deselected
        lockerFee: value === null ? '0' : prev.lockerFee,
      }));
    } else if (name === 'shiftIds') {
        const selectedShiftIds = option ? option.map((opt: { value: number }) => opt.value) : [];
        
        setFormData(prev => {
            let newTotalFee = '0';
            // Auto-calculate fee only if exactly one shift is selected
            if (selectedShiftIds.length === 1) {
                const selectedShift = shifts.find(shift => shift.id === selectedShiftIds[0]);
                newTotalFee = selectedShift ? selectedShift.fee.toString() : '0';
            } 
            
            return {
                ...prev,
                shiftIds: selectedShiftIds,
                totalFee: newTotalFee
            };
        });
    } else {
      const value = option ? option.value : null;
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Handle file input changes with validation
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (file) {
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/gif'].includes(file.type)) {
        toast.error('Only JPEG, JPG, PNG, and GIF images are allowed');
        return;
      }
      if (file.size > 200 * 1024) {
        toast.error('Image size exceeds 200KB limit');
        return;
      }
      setFormData(prev => ({ ...prev, image: file }));
    }
  };

  const handleAadhaarFrontChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (file) {
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/gif'].includes(file.type)) {
        toast.error('Only JPEG, JPG, PNG, and GIF images are allowed for Aadhaar front');
        return;
      }
      if (file.size > 200 * 1024) {
        toast.error('Aadhaar front image size exceeds 200KB limit');
        return;
      }
      setFormData(prev => ({ ...prev, aadhaarFront: file }));
    }
  };

  const handleAadhaarBackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (file) {
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/gif'].includes(file.type)) {
        toast.error('Only JPEG, JPG, PNG, and GIF images are allowed for Aadhaar back');
        return;
      }
      if (file.size > 200 * 1024) {
        toast.error('Aadhaar back image size exceeds 200KB limit');
        return;
      }
      setFormData(prev => ({ ...prev, aadhaarBack: file }));
    }
  };

  // Prepare options for react-select components
  const branchOptions: SelectOption[] = branches.map(branch => ({
    value: branch.id,
    label: branch.name,
  }));

  const seatOptions: SelectOption[] = [
    { value: null, label: 'None', isDisabled: false },
    ...seats.map(seat => ({
      value: seat.id,
      label: seat.seatNumber,
      isDisabled: false,
    })),
  ];

  const lockerOptions: SelectOption[] = [
    { value: null, label: 'None', isDisabled: false },
    ...lockers.filter(locker => !locker.isAssigned).map(locker => ({
      value: locker.id,
      label: locker.lockerNumber,
      isDisabled: false,
    })),
  ];

  const shiftOptions: ShiftOption[] = shifts.map(shift => {
    const isAvailable = availableShifts.some(s => s.id === shift.id);
    const label = formData.seatId !== null
      ? `${shift.title} - [Fee: ${shift.fee}] ${isAvailable ? '(Available)' : '(Assigned)'}`
      : `${shift.title} - [Fee: ${shift.fee}]`;
    return {
      value: shift.id,
      label,
      isDisabled: formData.seatId !== null ? !isAvailable : false,
    };
  });

  // Handle form submission
  const handleSubmit = async () => {
    if (
      !formData.name ||
      !formData.phone ||
      formData.branchId === null ||
      !formData.membershipStart ||
      !formData.membershipEnd
    ) {
      toast.error('Please fill in all required fields (Name, Phone, Branch, Membership Start, Membership End)');
      return;
    }

    try {
      // Upload images and get their URLs
      let imageUrl = formData.imageUrl || '';
      if (formData.image) {
        const imageFormData = new FormData();
        imageFormData.append('image', formData.image);
        const uploadResponse = await api.uploadImage(imageFormData);
        imageUrl = uploadResponse.imageUrl || '';
      }

      let aadhaarFrontUrl = formData.aadhaarFrontUrl || '';
      if (formData.aadhaarFront) {
        const frontFormData = new FormData();
        frontFormData.append('image', formData.aadhaarFront);
        const uploadResponse = await api.uploadImage(frontFormData);
        aadhaarFrontUrl = uploadResponse.imageUrl || '';
      }

      let aadhaarBackUrl = formData.aadhaarBackUrl || '';
      if (formData.aadhaarBack) {
        const backFormData = new FormData();
        backFormData.append('image', formData.aadhaarBack);
        const uploadResponse = await api.uploadImage(backFormData);
        aadhaarBackUrl = uploadResponse.imageUrl || '';
      }

      // Prepare student data for API submission
      const studentData = {
        name: formData.name,
        registrationNumber: formData.registrationNumber || undefined,
        fatherName: formData.fatherName || undefined,
        aadharNumber: formData.aadharNumber || undefined,
        email: formData.email || undefined,
        phone: formData.phone,
        address: formData.address?.trim() || undefined,
        branchId: formData.branchId!,
        membershipStart: formData.membershipStart,
        membershipEnd: formData.membershipEnd,
        totalFee: formData.totalFee ? parseFloat(formData.totalFee) : 0,
        lockerFee: formData.lockerFee ? parseFloat(formData.lockerFee) : 0,
        amountPaid: (parseFloat(formData.cash) || 0) + (parseFloat(formData.online) || 0),
        cash: parseFloat(formData.cash) || 0,
        online: parseFloat(formData.online) || 0,
        securityMoney: parseFloat(formData.securityMoney) || 0,
        discount: parseFloat(formData.discount) || 0,
        remark: formData.remark || undefined,
        profileImageUrl: imageUrl || undefined,
        aadhaarFrontUrl: aadhaarFrontUrl || undefined,
        aadhaarBackUrl: aadhaarBackUrl || undefined,
        seatId: formData.seatId !== null ? formData.seatId : undefined,
        shiftIds: formData.shiftIds,
        lockerId: formData.lockerId !== null ? formData.lockerId : undefined,
      };

      await api.addStudent(studentData);
      toast.success('Student added successfully');
      navigate('/students');
    } catch (error: any) {
      console.error('Failed to add student:', error);
      toast.error(error.message || 'Failed to add student');
    }
  };

  // Calculated values for display
  const cashAmount = parseFloat(formData.cash) || 0;
  const onlineAmount = parseFloat(formData.online) || 0;
  const totalAmountPaid = cashAmount + onlineAmount;
  const effectiveTotalFee = (parseFloat(formData.totalFee) || 0) - (parseFloat(formData.discount) || 0);
  const dueAmount = effectiveTotalFee - totalAmountPaid;
  const isFeeReadOnly = formData.shiftIds.length === 1;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Add New Student</h1>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      <div className="space-y-4">
        {/* Form Fields */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            required
          />
        </div>
        <div>
          <label htmlFor="registrationNumber" className="block text-sm font-medium text-gray-700 mb-1">
            Registration Number *
          </label>
          <input
            type="text"
            id="registrationNumber"
            name="registrationNumber"
            value={formData.registrationNumber || ''}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="fatherName" className="block text-sm font-medium text-gray-700 mb-1">
            Father's Name
          </label>
          <input
            type="text"
            id="fatherName"
            name="fatherName"
            value={formData.fatherName || ''}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="aadharNumber" className="block text-sm font-medium text-gray-700 mb-1">
            Aadhar Number
          </label>
          <input
            type="text"
            id="aadharNumber"
            name="aadharNumber"
            value={formData.aadharNumber || ''}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email || ''}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone *
          </label>
          <input
            type="text"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            required
          />
        </div>
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
            Address *
          </label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address || ''}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="branchId" className="block text-sm font-medium text-gray-700 mb-1">
            Branch *
          </label>
          <Select
            options={branchOptions}
            value={branchOptions.find(option => option.value === formData.branchId) || null}
            onChange={(option: SelectOption | null) => handleSelectChange('branchId', option)}
            placeholder="Select a branch"
            className="w-full"
            isDisabled={branches.length === 0}
            required
          />
        </div>
        <div>
          <label htmlFor="membershipStart" className="block text-sm font-medium text-gray-700 mb-1">
            Membership Start *
          </label>
          <input
            type="date"
            id="membershipStart"
            name="membershipStart"
            value={formData.membershipStart}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            required
          />
        </div>
        <div>
          <label htmlFor="membershipEnd" className="block text-sm font-medium text-gray-700 mb-1">
            Membership End *
          </label>
          <input
            type="date"
            id="membershipEnd"
            name="membershipEnd"
            value={formData.membershipEnd}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            required
          />
        </div>
        <div>
          <label htmlFor="seatId" className="block text-sm font-medium text-gray-700 mb-1">
            Select Seat
          </label>
          <Select
            options={seatOptions}
            value={seatOptions.find(option => option.value === formData.seatId) || null}
            onChange={(option: SelectOption | null) => handleSelectChange('seatId', option)}
            isLoading={loadingSeats}
            placeholder={formData.branchId ? "Select a seat" : "Select a branch first"}
            className="w-full"
            isDisabled={!formData.branchId || seats.length === 0}
          />
        </div>
        <div>
          <label htmlFor="shiftIds" className="block text-sm font-medium text-gray-700 mb-1">
            Select Shifts
          </label>
          <Select
            isMulti
            options={shiftOptions}
            value={shiftOptions.filter(option => formData.shiftIds.includes(option.value))}
            onChange={(options) => handleSelectChange('shiftIds', options)}
            isLoading={loadingShifts}
            placeholder="Select shifts"
            className="w-full"
            isDisabled={shifts.length === 0}
          />
        </div>
        <div>
          <label htmlFor="lockerId" className="block text-sm font-medium text-gray-700 mb-1">
            Select Locker
          </label>
          <Select
            options={lockerOptions}
            value={lockerOptions.find(option => option.value === formData.lockerId) || null}
            onChange={(option: SelectOption | null) => handleSelectChange('lockerId', option)}
            isLoading={loadingLockers}
            placeholder={formData.branchId ? "Select an available locker" : "Select a branch first"}
            className="w-full"
            isDisabled={!formData.branchId || lockers.length === 0}
          />
        </div>
        {formData.lockerId !== null && (
          <div>
            <label htmlFor="lockerFee" className="block text-sm font-medium text-gray-700 mb-1">
              Locker Fee
            </label>
            <input
              type="number"
              id="lockerFee"
              name="lockerFee"
              value={formData.lockerFee}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
        )}
        <div>
          <label htmlFor="totalFee" className="block text-sm font-medium text-gray-700 mb-1">
            {isFeeReadOnly ? 'Membership Fee (Auto-calculated) *' : 'Membership Fee *'}
          </label>
          <input
            type="number"
            id="totalFee"
            name="totalFee"
            value={formData.totalFee}
            onChange={handleChange}
            readOnly={isFeeReadOnly}
            className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 ${
                isFeeReadOnly ? 'bg-gray-100' : ''
            }`}
          />
        </div>
        <div>
          <label htmlFor="discount" className="block text-sm font-medium text-gray-700 mb-1">
            Discount
          </label>
          <input
            type="number"
            id="discount"
            name="discount"
            value={formData.discount}
            onChange={handleChange}
            step="0.01"
            min="0"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="cash" className="block text-sm font-medium text-gray-700 mb-1">
            Cash Payment
          </label>
          <input
            type="number"
            id="cash"
            name="cash"
            value={formData.cash}
            onChange={handleChange}
            step="0.01"
            min="0"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="online" className="block text-sm font-medium text-gray-700 mb-1">
            Online Payment
          </label>
          <input
            type="number"
            id="online"
            name="online"
            value={formData.online}
            onChange={handleChange}
            step="0.01"
            min="0"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="securityMoney" className="block text-sm font-medium text-gray-700 mb-1">
            Security Money
          </label>
          <input
            type="number"
            id="securityMoney"
            name="securityMoney"
            value={formData.securityMoney}
            onChange={handleChange}
            step="0.01"
            min="0"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="amountPaid" className="block text-sm font-medium text-gray-700 mb-1">
            Total Amount Paid
          </label>
          <input
            type="number"
            id="amountPaid"
            name="amountPaid"
            value={totalAmountPaid.toFixed(2)}
            readOnly
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
          />
        </div>
        <div>
          <label htmlFor="dueAmount" className="block text-sm font-medium text-gray-700 mb-1">
            Due Amount
          </label>
          <input
            type="number"
            id="dueAmount"
            name="dueAmount"
            value={dueAmount.toFixed(2)}
            readOnly
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
          />
        </div>
        <div>
          <label htmlFor="remark" className="block text-sm font-medium text-gray-700 mb-1">
            Remark
          </label>
          <textarea
            id="remark"
            name="remark"
            value={formData.remark || ''}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            rows={3}
          />
        </div>
        <div>
          <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-1">
            Profile Image (max 200KB)
          </label>
          <input
            type="file"
            id="image"
            name="image"
            accept="image/*"
            onChange={handleImageChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label htmlFor="aadhaarFront" className="block text-sm font-medium text-gray-700 mb-1">
            Aadhaar Front Image (max 200KB)
          </label>
          <input
            type="file"
            id="aadhaarFront"
            name="aadhaarFront"
            accept="image/*"
            onChange={handleAadhaarFrontChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label htmlFor="aadhaarBack" className="block text-sm font-medium text-gray-700 mb-1">
            Aadhaar Back Image (max 200KB)
          </label>
          <input
            type="file"
            id="aadhaarBack"
            name="aadhaarBack"
            accept="image/*"
            onChange={handleAadhaarBackChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <button
          onClick={handleSubmit}
          className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition duration-200"
          disabled={!!error}
        >
          Add Student
        </button>
      </div>
    </div>
  );
};

export default AddStudentForm;