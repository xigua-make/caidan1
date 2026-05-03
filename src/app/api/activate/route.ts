import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 激活验证 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, deviceId } = body;

    if (!code || !deviceId) {
      return NextResponse.json(
        { success: false, error: '缺少激活码或设备ID' },
        { status: 400 }
      );
    }

    // 验证激活码格式（6位数字）
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, error: '激活码格式错误，必须为6位数字' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 查询激活码
    const { data: activationCode, error: queryError } = await client
      .from('activation_codes')
      .select('*')
      .eq('code', code)
      .single();

    if (queryError || !activationCode) {
      return NextResponse.json(
        { success: false, error: '激活码不存在' },
        { status: 404 }
      );
    }

    // 检查是否启用
    if (!activationCode.is_active) {
      return NextResponse.json(
        { success: false, error: '激活码已被禁用' },
        { status: 403 }
      );
    }

    // 获取首次激活记录，用于判断是否已耗尽
    const { data: firstRecord } = await client
      .from('activation_records')
      .select('activated_at')
      .eq('code_id', activationCode.id)
      .order('activated_at', { ascending: true })
      .limit(1);

    // 计算是否已耗尽（基于首次激活时间）
    const calculateExhausted = (firstActivatedAt: string | null): boolean => {
      if (!firstActivatedAt) return false;
      
      const firstTime = new Date(firstActivatedAt);
      const now = new Date();
      
      switch (activationCode.duration_type) {
        case '30s':
          return now.getTime() > firstTime.getTime() + 30 * 1000;
        case '1d':
          return now.getTime() > firstTime.getTime() + 24 * 60 * 60 * 1000;
        case '7d':
          return now.getTime() > firstTime.getTime() + 7 * 24 * 60 * 60 * 1000;
        case 'permanent':
          return false; // 永久不会耗尽
        default:
          return false;
      }
    };

    // 如果是30秒/1天/7天类型，检查是否已耗尽
    if (activationCode.duration_type !== 'permanent') {
      const firstActivatedAt = firstRecord && firstRecord.length > 0 ? firstRecord[0].activated_at : null;
      if (calculateExhausted(firstActivatedAt)) {
        return NextResponse.json(
          { success: false, error: '激活码已耗尽，请重新购买' },
          { status: 403 }
        );
      }
    }

    // 检查该设备是否已经激活过（同一设备重复激活不算使用次数）
    const { data: existingRecord } = await client
      .from('activation_records')
      .select('*')
      .eq('code_id', activationCode.id)
      .eq('device_id', deviceId)
      .single();

    // 如果该设备已经激活过，不更新时间，直接返回（以第一次为准）
    if (existingRecord) {
      return NextResponse.json({
        success: true,
        message: '激活成功（时间以首次激活为准）',
        codeId: activationCode.id,
        expiresAt: existingRecord.expires_at,
        durationType: activationCode.duration_type,
      });
    }

    // 新设备激活 - 检查使用次数
    if (activationCode.max_uses > 0 && activationCode.used_count >= activationCode.max_uses) {
      return NextResponse.json(
        { success: false, error: '激活码使用次数已达上限' },
        { status: 403 }
      );
    }

    // 计算过期时间（永久类型不设置过期时间）
    let recordExpiresAt: string | null = null;
    if (activationCode.duration_type !== 'permanent') {
      const baseTime = firstRecord && firstRecord.length > 0 ? new Date(firstRecord[0].activated_at) : new Date();
      switch (activationCode.duration_type) {
        case '30s':
          recordExpiresAt = new Date(baseTime.getTime() + 30 * 1000).toISOString();
          break;
        case '1d':
          recordExpiresAt = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000).toISOString();
          break;
        case '7d':
          recordExpiresAt = new Date(baseTime.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
          break;
      }
    }

    // 并行执行：增加使用次数 + 创建激活记录
    const [updateResult, insertResult] = await Promise.all([
      client
        .from('activation_codes')
        .update({ used_count: activationCode.used_count + 1 })
        .eq('id', activationCode.id),
      client
        .from('activation_records')
        .insert({
          code_id: activationCode.id,
          device_id: deviceId,
          expires_at: recordExpiresAt,
        })
    ]);

    if (updateResult.error) {
      console.error('更新使用次数失败:', updateResult.error);
      return NextResponse.json(
        { success: false, error: '激活失败，请稍后重试' },
        { status: 500 }
      );
    }

    if (insertResult.error) {
      console.error('创建激活记录失败:', insertResult.error);
      return NextResponse.json(
        { success: false, error: '激活失败，请稍后重试' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '激活成功',
      codeId: activationCode.id,
      expiresAt: recordExpiresAt,
      durationType: activationCode.duration_type,
    });

  } catch (error) {
    console.error('激活验证错误:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 验证激活状态 API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json(
        { success: false, error: '缺少设备ID' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 查询该设备的激活记录
    const { data: records, error } = await client
      .from('activation_records')
      .select('*')
      .eq('device_id', deviceId)
      .order('activated_at', { ascending: false });

    if (error) {
      console.error('查询激活记录失败:', error);
      return NextResponse.json(
        { success: false, error: '查询失败' },
        { status: 500 }
      );
    }

    if (!records || records.length === 0) {
      return NextResponse.json({
        success: true,
        activated: false,
        message: '未激活',
      });
    }

    // 获取关联的激活码信息
    const codeIds = [...new Set(records.map((r: { code_id: number }) => r.code_id))];
    const { data: codes, error: codesError } = await client
      .from('activation_codes')
      .select('id, is_active, duration_type')
      .in('id', codeIds);

    if (codesError) {
      console.error('查询激活码失败:', codesError);
      return NextResponse.json(
        { success: false, error: '查询失败' },
        { status: 500 }
      );
    }

    const codeMap = new Map<number, { is_active: boolean; duration_type: string }>(
      (codes || []).map((c: { id: number; is_active: boolean; duration_type: string }) => [c.id, c])
    );

    // 检查是否有有效的激活记录
    const now = new Date();
    const validRecord = records.find((record: { 
      expires_at: string | null; 
      code_id: number;
    }) => {
      const code = codeMap.get(record.code_id);
      // 如果关联的激活码被禁用，则无效
      if (!code || !code.is_active) {
        return false;
      }
      // 如果有过期时间且已过期，则无效
      if (record.expires_at && new Date(record.expires_at) < now) {
        return false;
      }
      return true;
    });

    if (validRecord) {
      const code = codeMap.get(validRecord.code_id);
      if (code) {
        return NextResponse.json({
          success: true,
          activated: true,
          codeId: validRecord.code_id,
          expiresAt: validRecord.expires_at,
          durationType: code.duration_type,
        });
      }
    }

    return NextResponse.json({
      success: true,
      activated: false,
      message: '激活已过期或已被禁用',
    });

  } catch (error) {
    console.error('验证激活状态错误:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
