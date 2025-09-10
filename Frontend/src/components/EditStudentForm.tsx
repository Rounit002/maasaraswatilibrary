import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../services/api';
import Select from 'react-select';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface Student {
  id: number;
  name: string;
  registrationNumber?: string | null;
  fatherName?: string | null;
  aadharNumber?: string | null;
  email: string;
  phone: string;
  address: string;
  branchId: number;
  branchName?: string;
  membershipStart: string;
  membershipEnd: string;
  status: 'active' | 'expired';
  totalFee: number;
  amountPaid: number;
  dueAmount: number;
  cash: number;
  online: number;
  securityMoney: number;
  discount: number;
  remark: string | null;
  profileImageUrl?: string | null;
  aadhaarFrontUrl?: string | null;
  aadhaarBackUrl?: string | null;
  lockerId?: number | null;
  lockerNumber?: string | null;
  lockerFee?: number | null;
  createdAt: string;
  assignments?: Array<{
    seatId: number;
    shiftId: number;
    seatNumber: string;
    shiftTitle: string;
  }>;
}

interface Schedule {
  id: number;
  title: string;
  description: string | null;
  time: string;
  eventDate: string;
  fee: number;
}

interface Seat {
  id: number;
  seatNumber: string;
  branchId?: number;
  shifts: Array<{
    shiftId: number;
    shiftTitle: string;
    isAssigned: boolean;
    studentName: string | null;
  }>;
}

interface Branch {
  id: number;
  name: string;
  code?: string | null;
}

interface Locker {
  id: number;
  lockerNumber: string;
  isAssigned: boolean;
  studentId?: number;
  studentName?: string;
}

interface FormData {
  name: string;
  registrationNumber: string;
  fatherName: string;
  aadharNumber: string;
  email: string;
  phone: string;
  address: string;
  branchId: number | null;
  membershipStart: string;
  membershipEnd: string;
  shiftIds: number[];
  seatId: number | null;
  lockerId: number | null;
  lockerFee: string;
  totalFee: string;
  cash: string;
  online: string;
  securityMoney: string;
  remark: string;
  discount: string;
  profileImage: File | null;
  profileImageUrl: string;
  aadhaarFrontImage: File | null;
  aadhaarFrontUrl: string;
  aadhaarBackImage: File | null;
  aadhaarBackUrl: string;
}

interface UpdateStudentPayload {
  name: string;
  registrationNumber: string;
  fatherName: string;
  aadharNumber: string;
  email: string;
  phone: string;
  address: string;
  branchId: number;
  membershipStart: string;
  membershipEnd: string;
  totalFee: number;
  amountPaid: number;
  discount: number;
  shiftIds: number[];
  seatId: number | null;
  lockerId: number | null;
  lockerFee: number;
  cash: number;
  online: number;
  securityMoney: number;
  remark: string;
  profileImageUrl: string;
  aadhaarFrontUrl: string;
  aadhaarBackUrl: string;
}

const EditStudentForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
    shiftIds: [],
    seatId: null,
    lockerId: null,
    lockerFee: '0',
    totalFee: '',
    cash: '',
    online: '',
    securityMoney: '',
    remark: '',
    discount: '0',
    profileImage: null,
    profileImageUrl: '',
    aadhaarFrontImage: null,
    aadhaarFrontUrl: '',
    aadhaarBackImage: null,
    aadhaarBackUrl: '',
  });
  const [shifts, setShifts] = useState<Schedule[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const studentId = id ? parseInt(id, 10) : NaN;
  if (isNaN(studentId)) {
    return <div className="p-6 text-red-500 text-center">Invalid student ID.</div>;
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studentResponse, shiftsResponse, branchesResponse, lockersResponse] = await Promise.all([
          api.getStudent(studentId),
          api.getSchedules(),
          api.getBranches(),
          api.getLockers(),
        ]);
        
        const student: Student = studentResponse;
        const currentShiftIds = student.assignments?.map(a => a.shiftId) || [];
        
        setFormData({
          name: student.name || '',
          registrationNumber: student.registrationNumber || '',
          fatherName: student.fatherName || '',
          aadharNumber: student.aadharNumber || '',
          email: student.email || '',
          phone: student.phone || '',
          address: student.address || '',
          branchId: student.branchId || null,
          membershipStart: student.membershipStart.split('T')[0],
          membershipEnd: student.membershipEnd.split('T')[0],
          shiftIds: currentShiftIds,
          seatId: student.assignments?.[0]?.seatId || null,
          lockerId: student.lockerId || null,
          lockerFee: student.lockerFee?.toString() || '0',
          totalFee: student.totalFee.toString(),
          cash: student.cash.toString(),
          online: student.online.toString(),
          securityMoney: student.securityMoney.toString(),
          discount: student.discount ? student.discount.toString() : '0',
          remark: student.remark || '',
          profileImage: null,
          profileImageUrl: student.profileImageUrl || '',
          aadhaarFrontImage: null,
          aadhaarFrontUrl: student.aadhaarFrontUrl || '',
          aadhaarBackImage: null,
          aadhaarBackUrl: student.aadhaarBackUrl || '',
        });

        const formattedSchedules = shiftsResponse.schedules.map((schedule: any) => ({
            ...schedule,
            fee: schedule.fee ?? 0,
        }));
        setShifts(formattedSchedules as Schedule[]);
        setBranches(branchesResponse);
        setLockers(lockersResponse.lockers as Locker[]);
      } catch (error: any) {
        console.error('Failed to fetch data:', error);
        const errorMessage = error.response?.status === 404
          ? 'Student not found'
          : error.response?.data?.message || error.message || 'Failed to load student, shifts, branches, or lockers';
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [studentId]);

  useEffect(() => {
    const fetchSeats = async () => {
      const branchId = formData.branchId;
      if (branchId) {
        setLoadingSeats(true);
        try {
          const seatsResponse = await api.getSeats({ branchId });
          setSeats(seatsResponse.seats);
        } catch (error: any) {
          console.error('Failed to fetch seats:', error);
          toast.error(error.response?.data?.message || 'Failed to load seats');
        } finally {
          setLoadingSeats(false);
        }
      } else {
        setSeats([]);
      }
    };
    fetchSeats();
  }, [formData.branchId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof FormData, option: any) => {
    if (name === 'branchId') {
      const value = option ? option.value : null;
      setFormData(prev => ({
        ...prev,
        branchId: value,
        seatId: null,
        shiftIds: [],
        totalFee: '0',
      }));
    } else if (name === 'seatId') {
      const value = option ? option.value : null;
      setFormData(prev => ({
        ...prev,
        seatId: value,
        shiftIds: [],
        totalFee: '0'
    }));
    } else if (name === 'shiftIds') {
        const selectedShiftIds = option ? option.map((opt: { value: number }) => opt.value) : [];
        
        setFormData(prev => {
            let newTotalFee = '0';
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
    } else if (name === 'lockerId') {
      const value = option ? option.value : null;
      setFormData(prev => ({
        ...prev,
        lockerId: value,
        lockerFee: value === null ? '0' : prev.lockerFee,
      }));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof FormData) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (file) {
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/gif'].includes(file.type)) {
        toast.error(`Only JPEG, JPG, PNG, and GIF images are allowed for ${field}`);
        return;
      }
      if (file.size > 200 * 1024) {
        toast.error(`Image size exceeds 200KB limit for ${field}`);
        return;
      }
      setFormData(prev => ({ ...prev, [field]: file }));
    }
  };

  const handleSubmit = async () => {
    if (
      !formData.name ||
      !formData.phone ||
      !formData.address ||
      formData.branchId === null ||
      !formData.membershipStart ||
      !formData.membershipEnd
    ) {
      toast.error('Please fill in all required fields: Name, Phone, Address, Branch, Membership Start, Membership End');
      return;
    }

    setSubmitting(true);
    try {
      let profileImageUrl = formData.profileImageUrl;
      if (formData.profileImage) {
        const imageFormData = new FormData();
        imageFormData.append('image', formData.profileImage);
        const uploadResponse = await api.uploadImage(imageFormData);
        profileImageUrl = uploadResponse.imageUrl || '';
      }

      let aadhaarFrontUrl = formData.aadhaarFrontUrl;
      if (formData.aadhaarFrontImage) {
        const frontFormData = new FormData();
        frontFormData.append('image', formData.aadhaarFrontImage);
        const uploadResponse = await api.uploadImage(frontFormData);
        aadhaarFrontUrl = uploadResponse.imageUrl || '';
      }

      let aadhaarBackUrl = formData.aadhaarBackUrl;
      if (formData.aadhaarBackImage) {
        const backFormData = new FormData();
        backFormData.append('image', formData.aadhaarBackImage);
        const uploadResponse = await api.uploadImage(backFormData);
        aadhaarBackUrl = uploadResponse.imageUrl || '';
      }

      const payload: UpdateStudentPayload = {
        name: formData.name,
        registrationNumber: formData.registrationNumber || '',
        fatherName: formData.fatherName || '',
        aadharNumber: formData.aadharNumber || '',
        email: formData.email || '',
        phone: formData.phone,
        address: formData.address,
        branchId: formData.branchId!,
        membershipStart: formData.membershipStart,
        membershipEnd: formData.membershipEnd,
        totalFee: parseFloat(formData.totalFee) || 0,
        amountPaid: (parseFloat(formData.cash) || 0) + (parseFloat(formData.online) || 0),
        discount: parseFloat(formData.discount) || 0,
        shiftIds: formData.shiftIds,
        seatId: formData.seatId,
        lockerId: formData.lockerId,
        lockerFee: parseFloat(formData.lockerFee) || 0,
        cash: parseFloat(formData.cash) || 0,
        online: parseFloat(formData.online) || 0,
        securityMoney: parseFloat(formData.securityMoney) || 0,
        remark: formData.remark || '',
        profileImageUrl: profileImageUrl || '',
        aadhaarFrontUrl: aadhaarFrontUrl || '',
        aadhaarBackUrl: aadhaarBackUrl || '',
      };

      await api.updateStudent(studentId, payload);
      toast.success('Student updated successfully');
      navigate(`/students/${studentId}`);
    } catch (error: any) {
      console.error('Failed to update student:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to update student');
    } finally {
      setSubmitting(false);
    }
  };

  const branchOptions = branches.map(branch => ({
    value: branch.id,
    label: branch.name,
  }));

  const seatOptions = [
    { value: null, label: 'None' },
    ...seats.map(seat => ({
      value: seat.id,
      label: seat.seatNumber,
    })),
  ];

  const shiftOptions = shifts.map(shift => ({
    value: shift.id,
    label: `${shift.title} - [Fee: ${shift.fee}]`,
  }));

  const lockerOptions = [
    { value: null, label: 'None' },
    ...lockers
      .filter(locker => !locker.isAssigned || locker.studentId === studentId)
      .map(locker => ({
        value: locker.id,
        label: locker.lockerNumber,
      })),
  ];

  const cashAmount = parseFloat(formData.cash) || 0;
  const onlineAmount = parseFloat(formData.online) || 0;
  const totalAmountPaid = cashAmount + onlineAmount;
  const effectiveTotalFee = (parseFloat(formData.totalFee) || 0) - (parseFloat(formData.discount) || 0);
  const dueAmount = effectiveTotalFee - totalAmountPaid;
  const isFeeReadOnly = formData.shiftIds.length === 1;

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate(`/students/${studentId}`)}
          className="mr-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h1 className="text-2xl font-bold">Edit Student</h1>
      </div>
      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
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
          <label htmlFor="registrationNumber" className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
          <input
            type="text"
            id="registrationNumber"
            name="registrationNumber"
            value={formData.registrationNumber}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="fatherName" className="block text-sm font-medium text-gray-700 mb-1">Father's Name</label>
          <input
            type="text"
            id="fatherName"
            name="fatherName"
            value={formData.fatherName}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="aadharNumber" className="block text-sm font-medium text-gray-700 mb-1">Aadhar Number</label>
          <input
            type="text"
            id="aadharNumber"
            name="aadharNumber"
            value={formData.aadharNumber}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
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
          <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            required
          />
        </div>
        <div>
          <label htmlFor="branchId" className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
          <Select
            options={branchOptions}
            value={branchOptions.find(option => option.value === formData.branchId) || null}
            onChange={(option) => handleSelectChange('branchId', option)}
            placeholder="Select a branch"
            className="w-full"
            isDisabled={branches.length === 0}
            required
          />
        </div>
        <div>
          <label htmlFor="membershipStart" className="block text-sm font-medium text-gray-700 mb-1">Membership Start</label>
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
          <label htmlFor="membershipEnd" className="block text-sm font-medium text-gray-700 mb-1">Membership End</label>
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
          <label htmlFor="seatId" className="block text-sm font-medium text-gray-700 mb-1">Select Seat</label>
          <Select
            options={seatOptions}
            value={seatOptions.find(option => option.value === formData.seatId) || null}
            onChange={(option) => handleSelectChange('seatId', option)}
            isLoading={loadingSeats}
            placeholder={formData.branchId ? "Select a seat" : "Select a branch first"}
            className="w-full"
            isDisabled={!formData.branchId || seats.length === 0}
          />
        </div>
        <div>
          <label htmlFor="shiftIds" className="block text-sm font-medium text-gray-700 mb-1">Select Shifts</label>
          <Select
            isMulti
            options={shiftOptions}
            value={shiftOptions.filter(option => formData.shiftIds.includes(option.value))}
            onChange={(option) => handleSelectChange('shiftIds', option)}
            placeholder="Select shifts"
            className="w-full"
            isDisabled={shifts.length === 0}
          />
        </div>
        <div>
          <label htmlFor="lockerId" className="block text-sm font-medium text-gray-700 mb-1">Select Locker</label>
          <Select
            options={lockerOptions}
            value={lockerOptions.find(option => option.value === formData.lockerId) || null}
            onChange={(option) => handleSelectChange('lockerId', option)}
            placeholder={formData.branchId ? "Select an available locker" : "Select a branch first"}
            className="w-full"
            isDisabled={!formData.branchId || lockers.length === 0}
          />
        </div>
        {formData.lockerId !== null && (
            <div className="mt-4">
              <label htmlFor="lockerFee" className="block text-sm font-medium text-gray-700 mb-1">Locker Fee</label>
              <input
                type="number"
                id="lockerFee"
                name="lockerFee"
                value={formData.lockerFee}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
        )}
        <div>
          <label htmlFor="totalFee" className="block text-sm font-medium text-gray-700 mb-1">Membership Fee</label>
           <input
            type="number"
            id="totalFee"
            name="totalFee"
            value={formData.totalFee}
            onChange={handleChange}
            readOnly={isFeeReadOnly}
            className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 ${isFeeReadOnly ? 'bg-gray-100' : ''}`}
            required
          />
        </div>
        <div>
          <label htmlFor="discount" className="block text-sm font-medium text-gray-700 mb-1">Discount</label>
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
          <label htmlFor="cash" className="block text-sm font-medium text-gray-700 mb-1">Cash Payment</label>
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
          <label htmlFor="online" className="block text-sm font-medium text-gray-700 mb-1">Online Payment</label>
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
          <label htmlFor="securityMoney" className="block text-sm font-medium text-gray-700 mb-1">Security Money</label>
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
          <label htmlFor="amountPaid" className="block text-sm font-medium text-gray-700 mb-1">Total Amount Paid</label>
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
          <label htmlFor="dueAmount" className="block text-sm font-medium text-gray-700 mb-1">Due Amount</label>
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
          <label htmlFor="remark" className="block text-sm font-medium text-gray-700 mb-1">Remark</label>
          <textarea
            id="remark"
            name="remark"
            value={formData.remark}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            rows={3}
          />
        </div>
        <div>
          <label htmlFor="profileImage" className="block text-sm font-medium text-gray-700 mb-1">Profile Image (max 200KB)</label>
          <input
            type="file"
            id="profileImage"
            name="profileImage"
            accept="image/*"
            onChange={(e) => handleImageChange(e, 'profileImage')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
          {formData.profileImageUrl && (
            <div className="mt-2">
              <img src={formData.profileImageUrl} alt="Profile Preview" className="h-20 w-20 object-cover rounded" />
            </div>
          )}
        </div>
        <div>
          <label htmlFor="aadhaarFrontImage" className="block text-sm font-medium text-gray-700 mb-1">Aadhaar Front Image (max 200KB)</label>
          <input
            type="file"
            id="aadhaarFrontImage"
            name="aadhaarFrontImage"
            accept="image/*"
            onChange={(e) => handleImageChange(e, 'aadhaarFrontImage')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
          {formData.aadhaarFrontUrl && (
            <div className="mt-2">
              <img src={formData.aadhaarFrontUrl} alt="Aadhaar Front Preview" className="h-20 w-20 object-cover rounded" />
            </div>
          )}
        </div>
        <div>
          <label htmlFor="aadhaarBackImage" className="block text-sm font-medium text-gray-700 mb-1">Aadhaar Back Image (max 200KB)</label>
          <input
            type="file"
            id="aadhaarBackImage"
            name="aadhaarBackImage"
            accept="image/*"
            onChange={(e) => handleImageChange(e, 'aadhaarBackImage')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
          {formData.aadhaarBackUrl && (
            <div className="mt-2">
              <img src={formData.aadhaarBackUrl} alt="Aadhaar Back Preview" className="h-20 w-20 object-cover rounded" />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate(`/students/${studentId}`)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Updating...' : 'Update Student'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EditStudentForm;